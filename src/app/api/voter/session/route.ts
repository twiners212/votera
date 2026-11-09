import { NextResponse } from "next/server";
import { getVoterSession } from "@/lib/auth/voter-session";
import { db } from "@/db";
import { voterGroups, elections } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const sessionData = await getVoterSession();

    if (!sessionData) {
      return NextResponse.json({
        authenticated: false,
        voter: null,
        election: null,
      });
    }

    const { voter, session } = sessionData;

    // Ambil info grup/rombel pemilih
    const [group] = await db
      .select({ name: voterGroups.name })
      .from(voterGroups)
      .where(eq(voterGroups.id, voter.groupId))
      .limit(1);

    // Ambil info pemilihan
    const [election] = await db
      .select({
        id: elections.id,
        slug: elections.slug,
        title: elections.title,
        shortName: elections.shortName,
        organizationName: elections.organizationName,
        status: elections.status,
        startAt: elections.startAt,
        endAt: elections.endAt,
      })
      .from(elections)
      .where(eq(elections.id, session.electionId))
      .limit(1);

    return NextResponse.json({
      authenticated: true,
      voter: {
        id: voter.id,
        name: voter.name,
        voterIdentity: voter.voterIdentity,
        hasVoted: voter.hasVoted,
        voterStatus: voter.voterStatus,
        votedAt: voter.votedAt,
        groupName: group?.name || null,
      },
      election: election || null,
    });
  } catch (error) {
    console.error("[Voter Session Check Error]:", error);
    return NextResponse.json(
      {
        authenticated: false,
        error: "INTERNAL_ERROR",
        message: "Gagal memeriksa status sesi pemilih.",
      },
      { status: 500 }
    );
  }
}
