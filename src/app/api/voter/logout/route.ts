import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, voters, voterSessions } from "@/db";
import { insertAuditLog } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";
import {
  VOTER_SESSION_COOKIE,
  clearVoterSessionCookie,
  getVoterSession,
} from "@/lib/auth/voter-session";

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get(VOTER_SESSION_COOKIE)?.value ?? null;
    const voter = await getVoterSession(rawCookie);

    if (voter) {
      await db
        .delete(voterSessions)
        .where(eq(voterSessions.sessionTokenHash, voter.sessionTokenHash));

      if (!voter.hasVoted) {
        await db
          .update(voters)
          .set({
            voterStatus: "not_voted",
            updatedAt: sql`now()`,
          })
          .where(and(eq(voters.id, voter.id), eq(voters.hasVoted, false)));
      }

      await insertAuditLog({
        electionId: voter.electionId,
        actorType: "voter",
        actorId: voter.id,
        actorName: voter.name,
        actorIdentity: `NIS ${voter.voterIdentity}`,
        action: "voter_logout",
        actionTitle: "Pemilih keluar",
        description: "Pemilih keluar dari sesi pemilihan",
        ipAddress: getClientIp(request),
      });
    }

    const response = NextResponse.json(
      {
        success: true,
        data: { loggedOut: true },
      },
      { status: 200 }
    );
    clearVoterSessionCookie(response);
    return response;
  } catch (error) {
    console.error("[POST /api/voter/logout] Unexpected error:", error);
    const response = NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Gagal memproses keluar sesi.",
        },
      },
      { status: 500 }
    );
    clearVoterSessionCookie(response);
    return response;
  }
}
