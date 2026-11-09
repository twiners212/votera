import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { voters, voterGroups, elections } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";
import {
  generateVoterToken,
  hashVoterToken,
  encryptVoterToken,
} from "@/lib/crypto/token";

function sanitizeFormula(input: string): string {
  // Cegah CSV / Spreadsheet formula injection
  return input.replace(/^[=+\-@\t\r]+/, "").trim();
}

const importRowSchema = z.object({
  voterIdentity: z
    .string()
    .trim()
    .min(1, "NIS/Identitas wajib diisi")
    .transform(sanitizeFormula),
  name: z
    .string()
    .trim()
    .min(1, "Nama pemilih wajib diisi")
    .transform(sanitizeFormula),
  groupName: z
    .string()
    .trim()
    .min(1, "Nama rombel wajib diisi")
    .transform(sanitizeFormula),
});

const bulkImportSchema = z.object({
  voters: z.array(importRowSchema).min(1, "Minimal sertakan 1 data pemilih"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = bulkImportSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    if (!activeElection) {
      return NextResponse.json(
        { success: false, error: "NO_ACTIVE_ELECTION", message: "Tidak ada pemilihan aktif." },
        { status: 404 }
      );
    }

    const rawRows = result.data.voters;

    // 1. Ambil daftar rombel yang sudah ada di database
    const existingGroups = await db
      .select()
      .from(voterGroups)
      .where(eq(voterGroups.electionId, activeElection.id));

    const groupMap = new Map<string, string>(); // groupName -> groupId
    for (const g of existingGroups) {
      groupMap.set(g.name.toLowerCase().trim(), g.id);
    }

    // 2. Buat grup baru jika belum ada di database
    const uniqueGroupNames = Array.from(new Set(rawRows.map((r) => r.groupName.trim())));
    for (const gName of uniqueGroupNames) {
      const key = gName.toLowerCase();
      if (!groupMap.has(key)) {
        const [newGroup] = await db
          .insert(voterGroups)
          .values({
            electionId: activeElection.id,
            name: gName,
          })
          .returning();
        groupMap.set(key, newGroup.id);
      }
    }

    // 3. Ambil seluruh NIS yang sudah terdaftar di pemilihan ini untuk deteksi duplikasi
    const allNisList = rawRows.map((r) => r.voterIdentity);
    const existingVoters = await db
      .select({ voterIdentity: voters.voterIdentity })
      .from(voters)
      .where(eq(voters.electionId, activeElection.id));

    const existingNisSet = new Set(existingVoters.map((v) => v.voterIdentity));
    const processedNisInBatch = new Set<string>();

    const toInsert: Array<{
      electionId: string;
      groupId: string;
      voterIdentity: string;
      name: string;
      tokenHash: string;
      tokenEncrypted: string;
      hasVoted: boolean;
      voterStatus: "not_voted";
      failedLoginAttempts: number;
    }> = [];

    const skipped: string[] = [];

    for (const row of rawRows) {
      if (existingNisSet.has(row.voterIdentity) || processedNisInBatch.has(row.voterIdentity)) {
        skipped.push(row.voterIdentity);
        continue;
      }

      processedNisInBatch.add(row.voterIdentity);
      const groupId = groupMap.get(row.groupName.toLowerCase().trim());
      if (!groupId) continue;

      const rawToken = generateVoterToken();
      toInsert.push({
        electionId: activeElection.id,
        groupId,
        voterIdentity: row.voterIdentity,
        name: row.name,
        tokenHash: hashVoterToken(rawToken),
        tokenEncrypted: encryptVoterToken(rawToken),
        hasVoted: false,
        voterStatus: "not_voted",
        failedLoginAttempts: 0,
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "ALL_DUPLICATES",
          message: "Seluruh data yang diunggah sudah terdaftar di database DPT.",
          skippedCount: skipped.length,
        },
        { status: 409 }
      );
    }

    // 4. Batch insert (chunking per 100 baris)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      await db.insert(voters).values(chunk);
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
    await insertAuditLog({
      electionId: activeElection.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "dpt_imported",
      actionTitle: "Impor massal DPT",
      description: `Berhasil mengimpor ${toInsert.length} data pemilih DPT baru (${skipped.length} dilewati karena duplikasi)`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${toInsert.length} pemilih ke DPT.`,
      insertedCount: toInsert.length,
      skippedCount: skipped.length,
    });
  } catch (error) {
    console.error("[Bulk Import Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memproses impor DPT." },
      { status: 500 }
    );
  }
}
