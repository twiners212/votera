import { NextRequest } from "next/server";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, gradeLevels, majors, voterGroups, voters } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { revalidateElectionCaches } from "@/lib/admin/cached-aggregations";
import {
  decryptVoterToken,
  encryptVoterToken,
  generateVoterToken,
  hashVoterToken,
} from "@/lib/crypto/token";
import {
  bulkDeleteVotersSchema,
  createVoterSchema,
  voterQuerySchema,
} from "@/lib/validations/voter-admin";
import { insertAuditLog } from "@/lib/audit";
import type {
  PaginationMeta,
  VoterDTO,
  VoterListResponseDTO,
  VoterStatus,
  VoterSummaryDTO,
} from "@/types/votera";

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdminApiSession([
      "committee",
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const queryObj = {
      electionId: searchParams.get("electionId") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      groupId: searchParams.get("groupId") ?? undefined,
      gradeLevelId: searchParams.get("gradeLevelId") ?? undefined,
      majorId: searchParams.get("majorId") ?? undefined,
    };

    const parsed = voterQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    const election = await resolveTargetElection(parsed.data.electionId);
    if (!election) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Data pemilihan tidak ditemukan.",
        404
      );
    }

    const conditions = [eq(voters.electionId, election.id)];

    if (parsed.data.search) {
      const term = `%${parsed.data.search}%`;
      conditions.push(
        or(ilike(voters.voterIdentity, term), ilike(voters.name, term))!
      );
    }

    if (parsed.data.status && parsed.data.status !== "all") {
      conditions.push(eq(voters.voterStatus, parsed.data.status));
    }

    if (parsed.data.groupId && parsed.data.groupId !== "all") {
      conditions.push(eq(voters.groupId, parsed.data.groupId));
    }

    if (parsed.data.gradeLevelId && parsed.data.gradeLevelId !== "all") {
      conditions.push(eq(voterGroups.gradeLevelId, parsed.data.gradeLevelId));
    }

    if (parsed.data.majorId && parsed.data.majorId !== "all") {
      conditions.push(eq(voterGroups.majorId, parsed.data.majorId));
    }

    const whereClause = and(...conditions);

    // Count matching rows
    const [countRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(voters)
      .leftJoin(voterGroups, eq(voters.groupId, voterGroups.id))
      .where(whereClause);

    const total = countRow?.count ?? 0;
    const page = parsed.data.page;
    const limit = parsed.data.limit;
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: voters.id,
        electionId: voters.electionId,
        groupId: voters.groupId,
        groupName: voterGroups.name,
        gradeLevelId: voterGroups.gradeLevelId,
        gradeName: gradeLevels.name,
        majorId: voterGroups.majorId,
        majorName: majors.name,
        voterIdentity: voters.voterIdentity,
        name: voters.name,
        tokenEncrypted: voters.tokenEncrypted,
        voterStatus: voters.voterStatus,
        hasVoted: voters.hasVoted,
        failedLoginAttempts: voters.failedLoginAttempts,
        lockedUntil: voters.lockedUntil,
        lastLoginAt: voters.lastLoginAt,
        votedAt: voters.votedAt,
        createdAt: voters.createdAt,
      })
      .from(voters)
      .leftJoin(voterGroups, eq(voters.groupId, voterGroups.id))
      .leftJoin(gradeLevels, eq(voterGroups.gradeLevelId, gradeLevels.id))
      .leftJoin(majors, eq(voterGroups.majorId, majors.id))
      .where(whereClause)
      .orderBy(asc(voters.voterIdentity))
      .limit(limit)
      .offset(offset);

    // VOTE PRIVACY: Decrypt token ONLY if hasVoted === false; null if hasVoted === true
    const voterList: VoterDTO[] = rows.map((v) => {
      let token: string | null = null;
      if (!v.hasVoted) {
        try {
          token = decryptVoterToken(v.tokenEncrypted);
        } catch {
          token = "••••••••";
        }
      }

      return {
        id: v.id,
        electionId: v.electionId,
        groupId: v.groupId,
        groupName: v.groupName ?? "Tanpa Rombel",
        gradeLevelId: v.gradeLevelId ?? null,
        gradeName: v.gradeName ?? null,
        majorId: v.majorId ?? null,
        majorName: v.majorName ?? null,
        voterIdentity: v.voterIdentity,
        name: v.name,
        token,
        voterStatus: v.voterStatus as VoterStatus,
        hasVoted: v.hasVoted,
        failedLoginAttempts: v.failedLoginAttempts,
        lockedUntil: v.lockedUntil ? v.lockedUntil.toISOString() : null,
        lastLoginAt: v.lastLoginAt ? v.lastLoginAt.toISOString() : null,
        votedAt: v.votedAt ? v.votedAt.toISOString() : null,
        createdAt: v.createdAt.toISOString(),
      };
    });

    // Election-wide summary
    const [summaryRow] = await db
      .select({
        totalVoters: sql<number>`cast(count(*) as int)`,
        votesCast: sql<number>`cast(count(*) filter (where ${voters.hasVoted} = true) as int)`,
      })
      .from(voters)
      .where(eq(voters.electionId, election.id));

    const totalVoters = summaryRow?.totalVoters ?? 0;
    const votesCast = summaryRow?.votesCast ?? 0;
    const notVoted = Math.max(0, totalVoters - votesCast);
    const turnoutPercentage =
      totalVoters > 0
        ? Number(((votesCast / totalVoters) * 100).toFixed(1))
        : 0;

    const summary: VoterSummaryDTO = {
      totalVoters,
      votesCast,
      notVoted,
      turnoutPercentage,
    };

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };

    const responseData: VoterListResponseDTO = {
      voters: voterList,
      summary,
      meta,
    };

    return formatSuccessResponse(responseData, meta);
  } catch (error) {
    console.error("Voters GET route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memuat daftar pemilih.",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "committee",
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload JSON tidak valid.",
        400
      );
    }

    const parsed = createVoterSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    const election = await resolveTargetElection(parsed.data.electionId);
    if (!election) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Data pemilihan tidak ditemukan.",
        404
      );
    }

    // Check duplicate voterIdentity in election
    const [existingIdentity] = await db
      .select({ id: voters.id })
      .from(voters)
      .where(
        and(
          eq(voters.electionId, election.id),
          eq(voters.voterIdentity, parsed.data.voterIdentity)
        )
      )
      .limit(1);

    if (existingIdentity) {
      return formatErrorResponse(
        "CONFLICT",
        `Identitas pemilih "${parsed.data.voterIdentity}" sudah terdaftar dalam pemilihan ini.`,
        409
      );
    }

    // Check group belongs to election
    const [group] = await db
      .select()
      .from(voterGroups)
      .where(
        and(
          eq(voterGroups.id, parsed.data.groupId),
          eq(voterGroups.electionId, election.id)
        )
      )
      .limit(1);

    if (!group) {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Rombel tidak ditemukan dalam pemilihan ini.",
        400
      );
    }

    const rawToken = generateVoterToken(8);
    const tokenHash = hashVoterToken(rawToken);
    const tokenEncrypted = encryptVoterToken(rawToken);

    const [created] = await db
      .insert(voters)
      .values({
        electionId: election.id,
        groupId: parsed.data.groupId,
        voterIdentity: parsed.data.voterIdentity,
        name: parsed.data.name,
        tokenHash,
        tokenEncrypted,
        voterStatus: "not_voted",
        hasVoted: false,
      })
      .returning();

    await insertAuditLog({
      electionId: election.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "voter_created",
      actionTitle: "Pemilih ditambahkan",
      description: `Menambahkan pemilih identitas ${created.voterIdentity}: ${created.name}`,
      ipAddress: extractClientIp(request),
    });

    revalidateElectionCaches(election.id);

    const dto: VoterDTO = {
      id: created.id,
      electionId: created.electionId,
      groupId: created.groupId,
      groupName: group.name,
      gradeLevelId: group.gradeLevelId ?? null,
      gradeName: null,
      majorId: group.majorId ?? null,
      majorName: null,
      voterIdentity: created.voterIdentity,
      name: created.name,
      token: rawToken,
      voterStatus: created.voterStatus as VoterStatus,
      hasVoted: created.hasVoted,
      failedLoginAttempts: created.failedLoginAttempts,
      lockedUntil: null,
      lastLoginAt: null,
      votedAt: null,
      createdAt: created.createdAt.toISOString(),
    };

    return formatSuccessResponse(dto, undefined, 201);
  } catch (error) {
    console.error("Voters POST route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menambahkan pemilih.",
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload JSON tidak valid.",
        400
      );
    }

    const parsed = bulkDeleteVotersSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    const election = await resolveTargetElection(parsed.data.electionId);
    if (!election) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Data pemilihan tidak ditemukan.",
        404
      );
    }

    let deletedCount = 0;

    if (parsed.data.allNotVoted) {
      const deleted = await db
        .delete(voters)
        .where(
          and(
            eq(voters.electionId, election.id),
            eq(voters.hasVoted, false)
          )
        )
        .returning({ id: voters.id });

      deletedCount = deleted.length;
    } else if (parsed.data.voterIds && parsed.data.voterIds.length > 0) {
      const targetVoters = await db
        .select({
          id: voters.id,
          hasVoted: voters.hasVoted,
          voterIdentity: voters.voterIdentity,
          name: voters.name,
        })
        .from(voters)
        .where(
          and(
            eq(voters.electionId, election.id),
            inArray(voters.id, parsed.data.voterIds)
          )
        );

      if (targetVoters.length === 0) {
        return formatSuccessResponse({ deletedCount: 0 });
      }

      // VOTER IMMUTABILITY SAFEGUARD: Reject if any selected voter has already voted
      const votedVoters = targetVoters.filter((v) => v.hasVoted);
      if (votedVoters.length > 0) {
        return formatErrorResponse(
          "VOTER_IMMUTABLE",
          `Sebanyak ${votedVoters.length} pemilih yang dipilih sudah memberikan suara dan tidak dapat dihapus.`,
          409
        );
      }

      const unvotedIds = targetVoters.map((v) => v.id);
      const deleted = await db
        .delete(voters)
        .where(
          and(
            eq(voters.electionId, election.id),
            inArray(voters.id, unvotedIds)
          )
        )
        .returning({ id: voters.id });

      deletedCount = deleted.length;
    }

    await insertAuditLog({
      electionId: election.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "voters_bulk_deleted",
      actionTitle: "Pemilih dihapus massal",
      description: `Menghapus massal ${deletedCount} pemilih dari DPT`,
      ipAddress: extractClientIp(request),
    });

    revalidateElectionCaches(election.id);

    return formatSuccessResponse({ deletedCount });
  } catch (error) {
    console.error("Voters bulk DELETE route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menghapus pemilih secara massal.",
      500
    );
  }
}
