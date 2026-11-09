import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { voters, voterSessions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";
import {
  generateVoterToken,
  hashVoterToken,
  encryptVoterToken,
} from "@/lib/crypto/token";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const [voter] = await db.select().from(voters).where(eq(voters.id, id)).limit(1);

    if (!voter) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Pemilih tidak ditemukan." },
        { status: 404 }
      );
    }

    // Invariant: DILARANG me-reset token pemilih yang sudah memilih
    if (voter.hasVoted) {
      return NextResponse.json(
        {
          success: false,
          error: "VOTER_IMMUTABLE",
          message: "Pemilih sudah menggunakan hak suara, token tidak dapat direset.",
        },
        { status: 409 }
      );
    }

    // 1. Generate token 8 karakter baru
    const rawToken = generateVoterToken();
    const tokenHash = hashVoterToken(rawToken);
    const tokenEncrypted = encryptVoterToken(rawToken);

    // 2. Update voters: reset counter kegagalan & pasang token baru
    const [updated] = await db
      .update(voters)
      .set({
        tokenHash,
        tokenEncrypted,
        failedLoginAttempts: 0,
        lockedUntil: null,
        voterStatus: "not_voted",
        updatedAt: sql`now()`,
      })
      .where(eq(voters.id, id))
      .returning();

    // 3. Hapus seluruh sesi aktif pemilih tersebut di tabel voter_sessions
    await db.delete(voterSessions).where(eq(voterSessions.voterId, id));

    // 4. Catat audit log (SANGAT PENTING: DILARANG mencatat plaintext token ke audit log)
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
    await insertAuditLog({
      electionId: voter.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "token_reset",
      actionTitle: "Token pemilih direset",
      description: `Mereset token pemilih NIS ${voter.voterIdentity} (${voter.name}) dan membatalkan seluruh sesi aktif`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Token pemilih '${voter.name}' berhasil direset.`,
      token: rawToken,
    });
  } catch (error) {
    console.error("[Token Reset Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal mereset token pemilih." },
      { status: 500 }
    );
  }
}
