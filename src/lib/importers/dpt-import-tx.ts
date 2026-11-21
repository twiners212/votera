import { eq } from "drizzle-orm";
import { dbPool } from "@/db";
import {
  voters,
  voterGroups,
  gradeLevels,
  majors,
  elections,
} from "@/db/schema";
import {
  generateVoterToken,
  hashVoterToken,
  encryptVoterToken,
} from "@/lib/crypto/token";
import { insertAuditLog, type AuditDbExecutor } from "@/lib/audit";
import {
  BATCH_CHUNK_SIZE,
  MAX_IMPORT_ROWS,
  type ImportRowError,
  type ImportVoterRowInput,
} from "@/lib/importers/dpt-parser";

export interface BulkImportVotersResult {
  totalProcessed: number;
  insertedCount: number;
  failedCount: number;
  failures: ImportRowError[];
}

export interface ImportVotersTxParams {
  electionId: string;
  rows: ImportVoterRowInput[];
  autoCreateGroups?: boolean;
  actor?: {
    id?: string | null;
    name: string;
    identity: string;
    ipAddress?: string;
  };
}

/**
 * Execute transactional batch import of voters via Neon Serverless pool (dbPool.transaction).
 * - Enforces batch chunking (500 rows per query).
 * - Auto-creates master records (gradeLevels, majors, voterGroups) if autoCreateGroups is true.
 * - Generates CSPRNG 8-char tokens, HMAC-SHA256 hash, and AES-256-GCM ciphertexts.
 * - Records audit log inside the same transaction.
 * - Partial success: valid rows inserted, failures recorded and returned.
 */
export async function executeBulkImportTransaction(
  params: ImportVotersTxParams
): Promise<BulkImportVotersResult> {
  const { electionId, rows, autoCreateGroups = true, actor } = params;

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Jumlah baris melebihi batas maksimal ${MAX_IMPORT_ROWS.toLocaleString("id-ID")} baris.`
    );
  }

  if (rows.length === 0) {
    return {
      totalProcessed: 0,
      insertedCount: 0,
      failedCount: 0,
      failures: [],
    };
  }

  return await dbPool.transaction(async (tx) => {
    // 1. Resolve real target election ID if "active" or not provided
    let resolvedElectionId = electionId;
    if (!resolvedElectionId || resolvedElectionId === "active") {
      const activeElections = await tx
        .select({ id: elections.id })
        .from(elections)
        .where(eq(elections.isActive, true))
        .limit(1);

      if (activeElections.length > 0) {
        resolvedElectionId = activeElections[0].id;
      } else {
        const anyElection = await tx
          .select({ id: elections.id })
          .from(elections)
          .limit(1);
        if (anyElection.length === 0) {
          throw new Error("Data pemilihan tidak ditemukan di database.");
        }
        resolvedElectionId = anyElection[0].id;
      }
    }

    const failures: ImportRowError[] = [];

    // 2. Query existing voters in the election to detect database duplicates
    const existingVoters = await tx
      .select({ voterIdentity: voters.voterIdentity })
      .from(voters)
      .where(eq(voters.electionId, resolvedElectionId));

    const existingIdentitiesSet = new Set(
      existingVoters.map((v) => v.voterIdentity.trim().toLowerCase())
    );

    // 3. Query existing master records for resolving / auto-creating groups
    const existingGrades = await tx
      .select({ id: gradeLevels.id, name: gradeLevels.name })
      .from(gradeLevels)
      .where(eq(gradeLevels.electionId, resolvedElectionId));

    const existingMajorsList = await tx
      .select({ id: majors.id, name: majors.name })
      .from(majors)
      .where(eq(majors.electionId, resolvedElectionId));

    const existingGroupsList = await tx
      .select({ id: voterGroups.id, name: voterGroups.name })
      .from(voterGroups)
      .where(eq(voterGroups.electionId, resolvedElectionId));

    const gradeMap = new Map<string, string>();
    for (const g of existingGrades) {
      gradeMap.set(g.name.trim().toLowerCase(), g.id);
    }

    const majorMap = new Map<string, string>();
    for (const m of existingMajorsList) {
      majorMap.set(m.name.trim().toLowerCase(), m.id);
    }

    const groupMap = new Map<string, string>();
    for (const grp of existingGroupsList) {
      groupMap.set(grp.name.trim().toLowerCase(), grp.id);
    }

    // 4. Filter duplicates and prepare voter groups
    interface PreparedVoter {
      rowNumber: number;
      voterIdentity: string;
      name: string;
      groupName: string;
      gradeName?: string;
      majorName?: string;
    }

    const eligibleRows: PreparedVoter[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2;
      const normalizedIdentity = row.voterIdentity.trim().toLowerCase();

      // Check DB duplicate
      if (existingIdentitiesSet.has(normalizedIdentity)) {
        failures.push({
          rowNumber,
          voterIdentity: row.voterIdentity,
          reason: "NIS sudah terdaftar di database",
        });
        continue;
      }

      const normalizedGroup = row.groupName ? row.groupName.trim().toLowerCase() : "";
      if (!normalizedGroup) {
        failures.push({
          rowNumber,
          voterIdentity: row.voterIdentity,
          reason: "Nama Rombel/Kelas tidak boleh kosong",
        });
        continue;
      }

      // Check if group is missing when autoCreateGroups is false
      if (!autoCreateGroups && !groupMap.has(normalizedGroup)) {
        failures.push({
          rowNumber,
          voterIdentity: row.voterIdentity,
          reason: "Rombel/Kelas belum terdaftar di database",
        });
        continue;
      }

      eligibleRows.push({
        rowNumber,
        voterIdentity: row.voterIdentity,
        name: row.name,
        groupName: row.groupName,
        gradeName: row.gradeName,
        majorName: row.majorName,
      });
      existingIdentitiesSet.add(normalizedIdentity);
    }

    // 5. Auto-create missing master data in bulk (O(1) round-trips) if autoCreateGroups is true
    if (autoCreateGroups) {
      // 5a. Pre-extract unique missing grades
      const missingGradeMap = new Map<string, string>();
      for (const row of eligibleRows) {
        if (row.gradeName && row.gradeName.trim()) {
          const key = row.gradeName.trim().toLowerCase();
          if (!gradeMap.has(key) && !missingGradeMap.has(key)) {
            missingGradeMap.set(key, row.gradeName.trim());
          }
        }
      }

      if (missingGradeMap.size > 0) {
        let currentSortOrder = gradeMap.size;
        const gradesToInsert = Array.from(missingGradeMap.values()).map((name) => ({
          electionId: resolvedElectionId,
          name,
          sortOrder: ++currentSortOrder,
        }));

        const insertedGrades = await tx
          .insert(gradeLevels)
          .values(gradesToInsert)
          .onConflictDoNothing()
          .returning({ id: gradeLevels.id, name: gradeLevels.name });

        for (const g of insertedGrades) {
          gradeMap.set(g.name.trim().toLowerCase(), g.id);
        }

        // If conflict occurred (e.g. concurrent insert), hydrate missing from DB
        const stillMissing = Array.from(missingGradeMap.keys()).filter((k) => !gradeMap.has(k));
        if (stillMissing.length > 0) {
          const existing = await tx
            .select({ id: gradeLevels.id, name: gradeLevels.name })
            .from(gradeLevels)
            .where(eq(gradeLevels.electionId, resolvedElectionId));
          for (const g of existing) {
            gradeMap.set(g.name.trim().toLowerCase(), g.id);
          }
        }
      }

      // 5b. Pre-extract unique missing majors
      const missingMajorMap = new Map<string, string>();
      for (const row of eligibleRows) {
        if (row.majorName && row.majorName.trim()) {
          const key = row.majorName.trim().toLowerCase();
          if (!majorMap.has(key) && !missingMajorMap.has(key)) {
            missingMajorMap.set(key, row.majorName.trim());
          }
        }
      }

      if (missingMajorMap.size > 0) {
        let currentSortOrder = majorMap.size;
        const majorsToInsert = Array.from(missingMajorMap.values()).map((name) => {
          const shortCode = name
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 10);

          return {
            electionId: resolvedElectionId,
            name,
            code: shortCode || null,
            sortOrder: ++currentSortOrder,
          };
        });

        const insertedMajors = await tx
          .insert(majors)
          .values(majorsToInsert)
          .onConflictDoNothing()
          .returning({ id: majors.id, name: majors.name });

        for (const m of insertedMajors) {
          majorMap.set(m.name.trim().toLowerCase(), m.id);
        }

        // If conflict occurred, hydrate missing from DB
        const stillMissing = Array.from(missingMajorMap.keys()).filter((k) => !majorMap.has(k));
        if (stillMissing.length > 0) {
          const existing = await tx
            .select({ id: majors.id, name: majors.name })
            .from(majors)
            .where(eq(majors.electionId, resolvedElectionId));
          for (const m of existing) {
            majorMap.set(m.name.trim().toLowerCase(), m.id);
          }
        }
      }

      // 5c. Pre-extract unique missing voter groups, associating with hydrated grade & major IDs
      interface GroupCandidate {
        name: string;
        gradeLevelId: string | null;
        majorId: string | null;
      }
      const missingGroupMap = new Map<string, GroupCandidate>();

      for (const row of eligibleRows) {
        const groupKey = row.groupName.trim().toLowerCase();
        if (groupMap.has(groupKey)) continue;

        const gradeKey = row.gradeName?.trim().toLowerCase();
        const majorKey = row.majorName?.trim().toLowerCase();
        const resolvedGradeId = gradeKey ? (gradeMap.get(gradeKey) ?? null) : null;
        const resolvedMajorId = majorKey ? (majorMap.get(majorKey) ?? null) : null;

        const existing = missingGroupMap.get(groupKey);
        if (!existing) {
          missingGroupMap.set(groupKey, {
            name: row.groupName.trim(),
            gradeLevelId: resolvedGradeId,
            majorId: resolvedMajorId,
          });
        } else {
          if (!existing.gradeLevelId && resolvedGradeId) {
            existing.gradeLevelId = resolvedGradeId;
          }
          if (!existing.majorId && resolvedMajorId) {
            existing.majorId = resolvedMajorId;
          }
        }
      }

      if (missingGroupMap.size > 0) {
        let currentSortOrder = groupMap.size;
        const groupsToInsert = Array.from(missingGroupMap.values()).map((grp) => ({
          electionId: resolvedElectionId,
          name: grp.name,
          gradeLevelId: grp.gradeLevelId,
          majorId: grp.majorId,
          sortOrder: ++currentSortOrder,
        }));

        const insertedGroups = await tx
          .insert(voterGroups)
          .values(groupsToInsert)
          .onConflictDoNothing()
          .returning({ id: voterGroups.id, name: voterGroups.name });

        for (const g of insertedGroups) {
          groupMap.set(g.name.trim().toLowerCase(), g.id);
        }

        // If conflict occurred, hydrate missing from DB
        const stillMissing = Array.from(missingGroupMap.keys()).filter((k) => !groupMap.has(k));
        if (stillMissing.length > 0) {
          const existing = await tx
            .select({ id: voterGroups.id, name: voterGroups.name })
            .from(voterGroups)
            .where(eq(voterGroups.electionId, resolvedElectionId));
          for (const g of existing) {
            groupMap.set(g.name.trim().toLowerCase(), g.id);
          }
        }
      }
    }

    // 6. Build voter insert records with cryptographic tokens
    type NewVoter = typeof voters.$inferInsert;
    const votersToInsert: NewVoter[] = [];

    for (const row of eligibleRows) {
      const groupKey = row.groupName.trim().toLowerCase();
      const resolvedGroupId = groupMap.get(groupKey);

      if (!resolvedGroupId) {
        failures.push({
          rowNumber: row.rowNumber,
          voterIdentity: row.voterIdentity,
          reason: `Rombel/Kelas "${row.groupName}" gagal disiapkan`,
        });
        continue;
      }

      const tokenPlain = generateVoterToken(8);
      const tokenHash = hashVoterToken(tokenPlain);
      const tokenEncrypted = encryptVoterToken(tokenPlain);

      votersToInsert.push({
        electionId: resolvedElectionId,
        groupId: resolvedGroupId,
        voterIdentity: row.voterIdentity.trim(),
        name: row.name.trim(),
        tokenHash,
        tokenEncrypted,
        voterStatus: "not_voted",
        hasVoted: false,
        failedLoginAttempts: 0,
      });
    }

    // 7. Batch insert voters in chunks of 500 records
    let insertedCount = 0;
    for (let i = 0; i < votersToInsert.length; i += BATCH_CHUNK_SIZE) {
      const chunk = votersToInsert.slice(i, i + BATCH_CHUNK_SIZE);
      if (chunk.length > 0) {
        await tx.insert(voters).values(chunk);
        insertedCount += chunk.length;
      }
    }

    // 8. Record audit log inside the transaction
    await insertAuditLog({
      electionId: resolvedElectionId,
      actorType: "admin",
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? "Panitia",
      actorIdentity: actor?.identity ?? "admin",
      action: "voters_bulk_imported",
      actionTitle: "Import DPT Massal",
      description: `Berhasil mengimpor ${insertedCount} pemilih (${failures.length} gagal/dilewati) dari total ${rows.length} baris data.`,
      ipAddress: actor?.ipAddress ?? "::1",
      tx: tx as unknown as AuditDbExecutor,
    });

    return {
      totalProcessed: rows.length,
      insertedCount,
      failedCount: failures.length,
      failures,
    };
  });
}
