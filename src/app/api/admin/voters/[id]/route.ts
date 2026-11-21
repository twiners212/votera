import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db, gradeLevels, majors, voterGroups, voters } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { revalidateElectionCaches } from "@/lib/admin/cached-aggregations";
import { decryptVoterToken } from "@/lib/crypto/token";
import { updateVoterSchema } from "@/lib/validations/voter-admin";
import { uuidParamSchema } from "@/lib/validations/admin-common";
import { insertAuditLog } from "@/lib/audit";
import type { VoterDTO, VoterStatus } from "@/types/votera";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "committee",
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { id } = await context.params;
    const paramParsed = uuidParamSchema.safeParse({ id });
    if (!paramParsed.success) {
      return formatZodErrorResponse(paramParsed.error);
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload JSON tidak valid.",
        400
      );
    }

    const parsed = updateVoterSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    const [existing] = await db
      .select()
      .from(voters)
      .where(eq(voters.id, id))
      .limit(1);

    if (!existing) {
      return formatErrorResponse("NOT_FOUND", "Data pemilih tidak ditemukan.", 404);
    }

    // VOTER IMMUTABILITY: Reject edit if voter has already voted
    if (existing.hasVoted) {
      return formatErrorResponse(
        "VOTER_IMMUTABLE",
        "Pemilih yang sudah memberikan suara tidak dapat diubah.",
        409
      );
    }

    // Check duplicate voterIdentity if changed
    if (
      parsed.data.voterIdentity &&
      parsed.data.voterIdentity !== existing.voterIdentity
    ) {
      const [duplicate] = await db
        .select({ id: voters.id })
        .from(voters)
        .where(
          and(
            eq(voters.electionId, existing.electionId),
            eq(voters.voterIdentity, parsed.data.voterIdentity),
            ne(voters.id, id)
          )
        )
        .limit(1);

      if (duplicate) {
        return formatErrorResponse(
          "CONFLICT",
          `Identitas pemilih "${parsed.data.voterIdentity}" sudah terdaftar.`,
          409
        );
      }
    }

    // Check groupId if changed
    if (parsed.data.groupId && parsed.data.groupId !== existing.groupId) {
      const [group] = await db
        .select({ id: voterGroups.id })
        .from(voterGroups)
        .where(
          and(
            eq(voterGroups.id, parsed.data.groupId),
            eq(voterGroups.electionId, existing.electionId)
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
    }

    const [updated] = await db
      .update(voters)
      .set({
        ...(parsed.data.voterIdentity
          ? { voterIdentity: parsed.data.voterIdentity }
          : {}),
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.groupId ? { groupId: parsed.data.groupId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(voters.id, id))
      .returning();

    await insertAuditLog({
      electionId: updated.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "voter_updated",
      actionTitle: "Pemilih diperbarui",
      description: `Memperbarui data pemilih: ${updated.voterIdentity} - ${updated.name}`,
      ipAddress: extractClientIp(request),
    });

    revalidateElectionCaches(updated.electionId);

    const [groupDetails] = await db
      .select({
        groupName: voterGroups.name,
        gradeLevelId: voterGroups.gradeLevelId,
        gradeName: gradeLevels.name,
        majorId: voterGroups.majorId,
        majorName: majors.name,
      })
      .from(voterGroups)
      .leftJoin(gradeLevels, eq(voterGroups.gradeLevelId, gradeLevels.id))
      .leftJoin(majors, eq(voterGroups.majorId, majors.id))
      .where(eq(voterGroups.id, updated.groupId))
      .limit(1);

    let token: string | null = null;
    if (!updated.hasVoted) {
      try {
        token = decryptVoterToken(updated.tokenEncrypted);
      } catch {
        token = "••••••••";
      }
    }

    const dto: VoterDTO = {
      id: updated.id,
      electionId: updated.electionId,
      groupId: updated.groupId,
      groupName: groupDetails?.groupName ?? "Tanpa Rombel",
      gradeLevelId: groupDetails?.gradeLevelId ?? null,
      gradeName: groupDetails?.gradeName ?? null,
      majorId: groupDetails?.majorId ?? null,
      majorName: groupDetails?.majorName ?? null,
      voterIdentity: updated.voterIdentity,
      name: updated.name,
      token,
      voterStatus: updated.voterStatus as VoterStatus,
      hasVoted: updated.hasVoted,
      failedLoginAttempts: updated.failedLoginAttempts,
      lockedUntil: updated.lockedUntil ? updated.lockedUntil.toISOString() : null,
      lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
      votedAt: updated.votedAt ? updated.votedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };

    return formatSuccessResponse(dto);
  } catch (error) {
    console.error("Voter PATCH route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memperbarui data pemilih.",
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "committee",
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { id } = await context.params;
    const paramParsed = uuidParamSchema.safeParse({ id });
    if (!paramParsed.success) {
      return formatZodErrorResponse(paramParsed.error);
    }

    const [voter] = await db
      .select()
      .from(voters)
      .where(eq(voters.id, id))
      .limit(1);

    if (!voter) {
      return formatErrorResponse("NOT_FOUND", "Data pemilih tidak ditemukan.", 404);
    }

    // VOTER IMMUTABILITY: Reject with 409 if voter has already voted
    if (voter.hasVoted) {
      return formatErrorResponse(
        "VOTER_IMMUTABLE",
        "Pemilih yang sudah memberikan suara tidak dapat dihapus.",
        409
      );
    }

    await db.delete(voters).where(eq(voters.id, id));

    await insertAuditLog({
      electionId: voter.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "voter_deleted",
      actionTitle: "Pemilih dihapus",
      description: `Menghapus pemilih: ${voter.voterIdentity} - ${voter.name}`,
      ipAddress: extractClientIp(request),
    });

    revalidateElectionCaches(voter.electionId);

    return formatSuccessResponse({ id: voter.id });
  } catch (error) {
    console.error("Voter DELETE route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menghapus pemilih.",
      500
    );
  }
}
