import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, voters } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { decryptVoterToken } from "@/lib/crypto/token";
import { uuidParamSchema } from "@/lib/validations/admin-common";
import { insertAuditLog } from "@/lib/audit";
import {
  checkAdminCopyTokenRateLimit,
  createRateLimitResponse,
} from "@/lib/rate-limit";

async function handleCopyToken(
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

    const rateLimit = checkAdminCopyTokenRateLimit(session.user.id);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        30,
        `Terlalu banyak permintaan salin token. Silakan tunggu ${rateLimit.retryAfterSeconds} detik.`
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

    // VOTER IMMUTABILITY: Reject copying token if voter has voted or token is redacted
    if (voter.hasVoted || voter.tokenEncrypted === "[REDACTED]") {
      return formatErrorResponse(
        "VOTER_IMMUTABLE",
        "Token pemilih yang sudah memberikan suara tidak dapat disalin.",
        409
      );
    }

    const decrypted = decryptVoterToken(voter.tokenEncrypted);

    await insertAuditLog({
      electionId: voter.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "voter_token_copied",
      actionTitle: "Token pemilih disalin",
      description: `Menyalin token pemilih: ${voter.voterIdentity} - ${voter.name}`,
      ipAddress: extractClientIp(request),
    });

    return formatSuccessResponse({
      voterId: voter.id,
      voterIdentity: voter.voterIdentity,
      token: decrypted,
    });
  } catch (error) {
    console.error("Copy token route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menyalin token pemilih.",
      500
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleCopyToken(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handleCopyToken(request, context);
}
