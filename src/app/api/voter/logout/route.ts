import { NextRequest, NextResponse } from "next/server";
import { getVoterSession, invalidateVoterSession } from "@/lib/auth/voter-session";
import { insertAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const sessionData = await getVoterSession();

    if (sessionData) {
      const { voter, session } = sessionData;
      const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";

      await insertAuditLog({
        electionId: session.electionId,
        actorType: "voter",
        actorName: voter.name,
        actorIdentity: `NIS ${voter.voterIdentity}`,
        action: "voter_logout",
        actionTitle: "Logout pemilih",
        description: `Pemilih NIS ${voter.voterIdentity} (${voter.name}) keluar dari sesi.`,
        ipAddress,
      });

      await invalidateVoterSession();
    } else {
      await invalidateVoterSession();
    }

    return NextResponse.json({
      success: true,
      message: "Berhasil keluar dari sesi pemilihan.",
    });
  } catch (error) {
    console.error("[Voter Logout Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Gagal memproses logout pemilih.",
      },
      { status: 500 }
    );
  }
}
