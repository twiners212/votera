import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getVoterSession } from "@/lib/auth/voter-session";
import { castVoteTransaction } from "@/lib/voting/cast-vote";

const castVoteSchema = z.object({
  candidateId: z.string().uuid("ID kandidat tidak valid"),
});

export async function POST(request: NextRequest) {
  try {
    const sessionData = await getVoterSession();

    if (!sessionData) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message: "Sesi pemilihan kamu telah berakhir atau tidak valid. Silakan login kembali.",
        },
        { status: 401 }
      );
    }

    const { voter } = sessionData;

    // Cek awal apakah sudah memilih
    if (voter.hasVoted) {
      return NextResponse.json(
        {
          success: false,
          error: "ALREADY_VOTED",
          message: "Kamu sudah menggunakan hak suara pada pemilihan ini.",
          redirectUrl: "/vote/thanks",
        },
        { status: 409 }
      );
    }

    const body = await request.json();
    const result = castVoteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_ERROR",
          message: result.error.errors[0]?.message || "Pilihan kandidat tidak valid.",
        },
        { status: 400 }
      );
    }

    const { candidateId } = result.data;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
    const userAgent = request.headers.get("user-agent") || undefined;

    // Eksekusi transaksi atomik
    const voteResult = await castVoteTransaction({
      voterId: voter.id,
      candidateId,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "Suara berhasil tercatat secara aman dan rahasia.",
      redirectUrl: "/vote/thanks",
      votedAt: voteResult.votedAt,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (errMsg === "ALREADY_VOTED") {
      return NextResponse.json(
        {
          success: false,
          error: "ALREADY_VOTED",
          message: "Kamu sudah menggunakan hak suara. Pemungutan suara ganda tidak diizinkan.",
          redirectUrl: "/vote/thanks",
        },
        { status: 409 }
      );
    }

    if (errMsg === "ELECTION_CLOSED") {
      return NextResponse.json(
        {
          success: false,
          error: "ELECTION_CLOSED",
          message: "Pemungutan suara saat ini sedang ditutup atau di luar rentang jadwal resmi.",
        },
        { status: 403 }
      );
    }

    if (errMsg === "CANDIDATE_NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          error: "CANDIDATE_NOT_FOUND",
          message: "Kandidat yang dipilih tidak terdaftar atau tidak aktif.",
        },
        { status: 404 }
      );
    }

    console.error("[Cast Vote Endpoint Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Terjadi kesalahan sistem saat mencatat suara.",
      },
      { status: 500 }
    );
  }
}
