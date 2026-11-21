import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, elections, voterGroups, voters } from "@/db";
import { insertAuditLog } from "@/lib/audit";
import {
  checkVoterLoginRateLimit,
  createRateLimitResponse,
  getClientIp,
} from "@/lib/rate-limit";
import {
  createVoterSession,
  setVoterSessionCookie,
} from "@/lib/auth/voter-session";
import { verifyVoterToken } from "@/lib/crypto/token";
import { voterLoginSchema } from "@/lib/validations/voter";

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Payload JSON tidak valid.",
          },
        },
        { status: 400 }
      );
    }

    const parsed = voterLoginSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Data login tidak valid. Periksa kembali NIS dan Token.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { electionId, voterIdentity, token } = parsed.data;
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get("user-agent");

    const rateLimit = checkVoterLoginRateLimit(ipAddress, voterIdentity);
    if (!rateLimit.allowed) {
      const limit = rateLimit.layer === "ip" ? 120 : 10;
      return createRateLimitResponse(
        rateLimit,
        limit,
        `Terlalu banyak percobaan login. Silakan coba lagi dalam ${rateLimit.retryAfterSeconds} detik.`
      );
    }

    const [election] = await db
      .select({
        id: elections.id,
        status: elections.status,
        isActive: elections.isActive,
        isWithinSchedule: sql<boolean>`
          ${elections.status} = 'open'
          AND ${elections.startAt} IS NOT NULL
          AND ${elections.endAt} IS NOT NULL
          AND now() >= ${elections.startAt}
          AND now() <= ${elections.endAt}
        `,
      })
      .from(elections)
      .where(
        electionId
          ? eq(elections.id, electionId)
          : eq(elections.isActive, true)
      )
      .orderBy(desc(elections.createdAt))
      .limit(1);

    if (!election || !election.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ELECTION_CLOSED",
            message:
              "Pemungutan suara sedang tidak dibuka atau pemilihan aktif tidak ditemukan.",
          },
        },
        { status: 403 }
      );
    }

    const [voterRow] = await db
      .select({
        id: voters.id,
        electionId: voters.electionId,
        groupId: voters.groupId,
        groupName: voterGroups.name,
        voterIdentity: voters.voterIdentity,
        name: voters.name,
        tokenHash: voters.tokenHash,
        voterStatus: voters.voterStatus,
        hasVoted: voters.hasVoted,
        votedAt: voters.votedAt,
        failedLoginAttempts: voters.failedLoginAttempts,
        lockedUntil: voters.lockedUntil,
        isLocked: sql<boolean>`${voters.lockedUntil} IS NOT NULL AND ${voters.lockedUntil} > now()`,
        remainingLockMinutes: sql<number>`GREATEST(1, CEIL(EXTRACT(EPOCH FROM (${voters.lockedUntil} - now())) / 60.0))::int`,
      })
      .from(voters)
      .innerJoin(voterGroups, eq(voters.groupId, voterGroups.id))
      .where(
        and(
          eq(voters.electionId, election.id),
          eq(voters.voterIdentity, voterIdentity)
        )
      )
      .limit(1);

    if (!voterRow) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message:
              "NIS atau Token yang kamu masukkan salah. Silakan periksa kembali.",
          },
        },
        { status: 401 }
      );
    }

    if (voterRow.isLocked) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VOTER_LOCKED",
            message: `Terlalu banyak percobaan gagal. Akun pemilih terkunci sementara selama ${voterRow.remainingLockMinutes} menit.`,
            details: {
              remainingMinutes: voterRow.remainingLockMinutes,
            },
          },
        },
        { status: 403 }
      );
    }

    const isTokenValid = verifyVoterToken(token, voterRow.tokenHash);
    if (!isTokenValid) {
      const [updatedAttempt] = await db
        .update(voters)
        .set({
          failedLoginAttempts: sql`${voters.failedLoginAttempts} + 1`,
          lockedUntil: sql`CASE WHEN ${voters.failedLoginAttempts} + 1 >= 5 THEN now() + interval '15 minutes' ELSE ${voters.lockedUntil} END`,
          updatedAt: sql`now()`,
        })
        .where(eq(voters.id, voterRow.id))
        .returning({
          failedLoginAttempts: voters.failedLoginAttempts,
        });

      const nextAttempts =
        updatedAttempt?.failedLoginAttempts ?? voterRow.failedLoginAttempts + 1;
      const shouldLock = nextAttempts >= 5;

      await insertAuditLog({
        electionId: election.id,
        actorType: "voter",
        actorId: voterRow.id,
        actorName: voterRow.name,
        actorIdentity: `NIS ${voterRow.voterIdentity}`,
        action: "voter_login_failed",
        actionTitle: "Login pemilih gagal",
        description: shouldLock
          ? "Percobaan login gagal berulang; akun dikunci sementara selama 15 menit"
          : `Percobaan login gagal (percobaan ke-${nextAttempts})`,
        ipAddress,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: shouldLock
              ? "Token salah 5 kali berturut-turut. Akun pemilih dikunci sementara selama 15 menit."
              : "NIS atau Token yang kamu masukkan salah. Silakan periksa kembali.",
          },
        },
        { status: 401 }
      );
    }

    if (!voterRow.hasVoted && !election.isWithinSchedule) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ELECTION_CLOSED",
            message:
              "Pemungutan suara sedang tidak dibuka atau berada di luar jadwal resmi.",
          },
        },
        { status: 403 }
      );
    }

    await db
      .update(voters)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: sql`now()`,
        updatedAt: sql`now()`,
        ...(!voterRow.hasVoted && voterRow.voterStatus === "not_voted"
          ? { voterStatus: "logged_in" as const }
          : {}),
      })
      .where(eq(voters.id, voterRow.id));

    const session = await createVoterSession({
      voterId: voterRow.id,
      electionId: election.id,
      ipAddress,
      userAgent,
    });

    await insertAuditLog({
      electionId: election.id,
      actorType: "voter",
      actorId: voterRow.id,
      actorName: voterRow.name,
      actorIdentity: `NIS ${voterRow.voterIdentity}`,
      action: "voter_login",
      actionTitle: "Pemilih masuk",
      description: "Pemilih berhasil masuk ke sistem pemilihan",
      ipAddress,
    });

    const redirectTo = voterRow.hasVoted ? "/vote/thanks" : "/vote";

    const response = NextResponse.json(
      {
        success: true,
        data: {
          voter: {
            id: voterRow.id,
            electionId: voterRow.electionId,
            name: voterRow.name,
            voterIdentity: voterRow.voterIdentity,
            groupId: voterRow.groupId,
            groupName: voterRow.groupName,
            hasVoted: voterRow.hasVoted,
            votedAt: voterRow.votedAt ? voterRow.votedAt.toISOString() : null,
          },
          redirectTo,
        },
      },
      { status: 200 }
    );

    setVoterSessionCookie(response, session.cookieValue);
    return response;
  } catch (error) {
    console.error("[POST /api/voter/login] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Terjadi kesalahan pada server. Silakan coba lagi.",
        },
      },
      { status: 500 }
    );
  }
}
