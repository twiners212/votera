import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, voterSessions, voters } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import {
  encryptVoterToken,
  generateVoterToken,
  hashVoterToken,
} from "@/lib/crypto/token";
import { uuidParamSchema } from "@/lib/validations/admin-common";
import { insertAuditLog } from "@/lib/audit";
import {
  checkAdminResetTokenRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit";

export async function POST(
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

    const rateLimit = checkAdminResetTokenRateLimit(session.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        15,
        `Terlalu banyak permintaan reset token. Silakan tunggu ${rateLimit.retryAfterSeconds} detik.`
      );
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

    // VOTER IMMUTABILITY: Reject reset token if already voted
    if (voter.hasVoted) {
      return formatErrorResponse(
        "VOTER_IMMUTABLE",
        "Token pemilih yang sudah memberikan suara tidak dapat direset.",
        409
      );
    }

    const newToken = generateVoterToken(8);
    const tokenHash = hashVoterToken(newToken);
    const tokenEncrypted = encryptVoterToken(newToken);

    await db
      .update(voters)
      .set({
        tokenHash,
        tokenEncrypted,
        failedLoginAttempts: 0,
        lockedUntil: null,
        voterStatus: "not_voted",
        updatedAt: new Date(),
      })
      .where(eq(voters.id, id));

    // Clear any active sessions
    await db
      .delete(voterSessions)
      .where(eq(voterSessions.voterId, voter.id));

    await insertAuditLog({
      electionId: voter.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "voter_token_reset",
      actionTitle: "Token pemilih direset",
      description: `Mereset token pemilih: ${voter.voterIdentity} - ${voter.name}`,
      ipAddress: extractClientIp(request),
    });

    return formatSuccessResponse({
      voterId: voter.id,
      voterIdentity: voter.voterIdentity,
      newToken,
    });
  } catch (error) {
    console.error("Reset token route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat mereset token pemilih.",
      500
    );
  }
}
