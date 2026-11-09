import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { voters, elections } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { verifyVoterToken } from "@/lib/crypto/token";
import { createVoterSession, setVoterSessionCookie } from "@/lib/auth/voter-session";
import { insertAuditLog } from "@/lib/audit";

const voterLoginSchema = z.object({
  voterIdentity: z.string().trim().min(1, "Nomor identitas (NIS) wajib diisi."),
  token: z.string().trim().min(1, "Token wajib diisi.").toUpperCase(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = voterLoginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_ERROR",
          message: result.error.errors[0]?.message || "Data tidak valid.",
        },
        { status: 400 }
      );
    }

    const { voterIdentity, token } = result.data;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
    const userAgent = request.headers.get("user-agent") || undefined;
    const now = new Date();

    // 1. Ambil Pemilihan Aktif
    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    if (!activeElection) {
      return NextResponse.json(
        {
          success: false,
          error: "NO_ACTIVE_ELECTION",
          message: "Tidak ada pemilihan aktif saat ini.",
        },
        { status: 404 }
      );
    }

    // 2. Validasi Jadwal Pemilihan (Waktu Server)
    const isWithinSchedule =
      activeElection.status === "open" &&
      (!activeElection.startAt || now >= activeElection.startAt) &&
      (!activeElection.endAt || now <= activeElection.endAt);

    if (!isWithinSchedule) {
      return NextResponse.json(
        {
          success: false,
          error: "ELECTION_CLOSED",
          message: "Pemungutan suara sedang tidak dibuka atau di luar jadwal resmi.",
        },
        { status: 403 }
      );
    }

    // 3. Cari Data Pemilih di DPT
    const [voter] = await db
      .select()
      .from(voters)
      .where(
        and(
          eq(voters.electionId, activeElection.id),
          eq(voters.voterIdentity, voterIdentity)
        )
      )
      .limit(1);

    if (!voter) {
      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "voter",
        actorName: `NIS ${voterIdentity}`,
        actorIdentity: `NIS ${voterIdentity}`,
        action: "voter_login_failed",
        actionTitle: "Login gagal",
        description: `Percobaan login dengan identitas tidak terdaftar: NIS ${voterIdentity}`,
        ipAddress,
      });

      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "NIS atau token yang kamu masukkan salah.",
        },
        { status: 401 }
      );
    }

    // 4. Periksa Apakah Akun Terkunci Sementara (Account Lockout)
    if (voter.lockedUntil && new Date(voter.lockedUntil) > now) {
      const minutesLeft = Math.ceil(
        (new Date(voter.lockedUntil).getTime() - now.getTime()) / (60 * 1000)
      );

      return NextResponse.json(
        {
          success: false,
          error: "VOTER_LOCKED",
          message: `Akun terkunci sementara karena 5 kali salah token. Silakan coba lagi dalam ${minutesLeft} menit atau hubungi panitia.`,
        },
        { status: 403 }
      );
    }

    // 5. Verifikasi Token Pemilih (Timing-Safe)
    const isTokenValid = verifyVoterToken(token, voter.tokenHash);

    if (!isTokenValid) {
      const newFailedAttempts = voter.failedLoginAttempts + 1;
      const willLock = newFailedAttempts >= 5;
      const lockedUntil = willLock ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await db
        .update(voters)
        .set({
          failedLoginAttempts: newFailedAttempts,
          lockedUntil,
          updatedAt: sql`now()`,
        })
        .where(eq(voters.id, voter.id));

      await insertAuditLog({
        electionId: activeElection.id,
        actorType: "voter",
        actorId: voter.id,
        actorName: voter.name,
        actorIdentity: `NIS ${voter.voterIdentity}`,
        action: "voter_login_failed",
        actionTitle: "Login gagal",
        description: willLock
          ? `Akun dikunci 15 menit setelah 5 kali gagal login berturut-turut`
          : `Gagal login ke-${newFailedAttempts} (token salah)`,
        ipAddress,
      });

      if (willLock) {
        return NextResponse.json(
          {
            success: false,
            error: "VOTER_LOCKED",
            message:
              "Akun terkunci selama 15 menit karena 5 kali salah token. Hubungi panitia untuk mereset token kamu.",
            remainingAttempts: 0,
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "INVALID_CREDENTIALS",
          message: "NIS atau token yang kamu masukkan salah.",
          remainingAttempts: Math.max(0, 5 - newFailedAttempts),
        },
        { status: 401 }
      );
    }

    // 6. Token Valid: Reset Lockout & Perbarui Status Pemilih
    const newStatus = voter.hasVoted ? "voted" : "logged_in";
    await db
      .update(voters)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: sql`now()`,
        voterStatus: newStatus,
        updatedAt: sql`now()`,
      })
      .where(eq(voters.id, voter.id));

    // 7. Buat Sesi Pemilih & Set Cookie HttpOnly
    const { token: sessionToken, expiresAt } = await createVoterSession({
      voterId: voter.id,
      electionId: activeElection.id,
      ipAddress,
      userAgent,
    });

    await setVoterSessionCookie(sessionToken, expiresAt);

    // 8. Catat Audit Log Login Berhasil
    await insertAuditLog({
      electionId: activeElection.id,
      actorType: "voter",
      actorId: voter.id,
      actorName: voter.name,
      actorIdentity: `NIS ${voter.voterIdentity}`,
      action: "voter_login",
      actionTitle: "Pemilih login",
      description: `Pemilih berhasil login ke sistem`,
      ipAddress,
    });

    const redirectUrl = voter.hasVoted ? "/vote/thanks" : "/vote";

    const response = NextResponse.json({
      success: true,
      message: "Login berhasil.",
      redirectUrl,
      voter: {
        id: voter.id,
        name: voter.name,
        voterIdentity: voter.voterIdentity,
        hasVoted: voter.hasVoted,
        voterStatus: newStatus,
      },
    });

    response.cookies.set("votera_voter_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("Error pada voter login:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Terjadi kesalahan pada server saat login.",
      },
      { status: 500 }
    );
  }
}
