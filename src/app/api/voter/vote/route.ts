import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  checkVoteSubmissionRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
  getClientIp,
} from "@/lib/rate-limit";
import {
  VOTER_SESSION_COOKIE,
  getVoterSession,
} from "@/lib/auth/voter-session";
import { castVoteSchema } from "@/lib/validations/voter";
import { VotingError, castVoteTransaction } from "@/lib/voting/cast-vote";

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get(VOTER_SESSION_COOKIE)?.value ?? null;
    const voter = await getVoterSession(rawCookie);
    if (!voter) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "Sesi pemilih tidak valid atau telah berakhir. Silakan masuk kembali.",
          },
        },
        { status: 401 }
      );
    }

    const voteRateLimit = checkVoteSubmissionRateLimit(voter.id);
    if (!voteRateLimit.allowed) {
      return createRateLimitResponse(
        voteRateLimit,
        15,
        `Terlalu banyak permintaan pemungutan suara. Silakan tunggu ${voteRateLimit.retryAfterSeconds} detik.`
      );
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Payload pilihan kandidat tidak valid.",
          },
        },
        { status: 400 }
      );
    }

    const parsed = castVoteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Pilihan kandidat tidak valid.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const ipAddress = getClientIp(request);
    const result = await castVoteTransaction({
      electionId: voter.electionId,
      voterId: voter.id,
      candidateId: parsed.data.candidateId,
      ipAddress,
    });

    try {
      revalidateTag("election-results");
      revalidateTag("election-dashboard");
      revalidateTag(voter.electionId);
      revalidatePath("/vote");
      revalidatePath("/vote/thanks");
      revalidatePath("/admin/dashboard");
      revalidatePath("/admin/results");
    } catch {
      // Abaikan jika dipanggil di luar konteks request Next.js (mis. unit/integration test)
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          votedAt: result.votedAt,
          redirectTo: "/vote/thanks",
        },
      },
      {
        status: 200,
        headers: createRateLimitHeaders(voteRateLimit, 15),
      }
    );
  } catch (error) {
    if (error instanceof VotingError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status }
      );
    }

    console.error("[POST /api/voter/vote] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Terjadi kesalahan saat menyimpan suara. Silakan coba beberapa saat lagi.",
        },
      },
      { status: 500 }
    );
  }
}
