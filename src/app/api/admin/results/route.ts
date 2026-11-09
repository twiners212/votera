import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  elections,
  candidates,
  voters,
  voterGroups,
  votes,
} from "@/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    // 1. Ambil data pemilihan aktif
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
          message: "Tidak ada pemilihan aktif.",
        },
        { status: 404 }
      );
    }

    // 2. Hitung total DPT dan jumlah yang sudah memilih
    const [voterStats] = await db
      .select({
        total: count(voters.id),
        voted: count(sql`CASE WHEN ${voters.hasVoted} = true THEN 1 END`),
      })
      .from(voters)
      .where(eq(voters.electionId, activeElection.id));

    const totalVoters = Number(voterStats?.total || 0);
    const votedCount = Number(voterStats?.voted || 0);
    const unvotedCount = Math.max(0, totalVoters - votedCount);
    const turnoutPercentage =
      totalVoters > 0
        ? Number(((votedCount / totalVoters) * 100).toFixed(1))
        : 0;

    // 3. Hitung total suara di tabel votes
    const [votesStats] = await db
      .select({ total: count() })
      .from(votes)
      .where(eq(votes.electionId, activeElection.id));
    const totalVotes = Number(votesStats?.total || 0);

    // 4. Hitung perolehan suara per kandidat aktif
    const candidateVotesRaw = await db
      .select({
        id: candidates.id,
        candidateNumber: candidates.candidateNumber,
        name: candidates.name,
        classOrUnit: candidates.classOrUnit,
        motto: candidates.motto,
        photoUrl: candidates.photoUrl,
        themeColor: candidates.themeColor,
        voteCount: count(votes.id),
      })
      .from(candidates)
      .leftJoin(votes, eq(votes.candidateId, candidates.id))
      .where(
        and(
          eq(candidates.electionId, activeElection.id),
          eq(candidates.isActive, true)
        )
      )
      .groupBy(
        candidates.id,
        candidates.candidateNumber,
        candidates.name,
        candidates.classOrUnit,
        candidates.motto,
        candidates.photoUrl,
        candidates.themeColor
      )
      .orderBy(desc(count(votes.id)), candidates.candidateNumber);

    // Tentukan perolehan suara tertinggi untuk menandai pemimpin sementara
    const maxVotes = candidateVotesRaw.reduce(
      (max, c) => Math.max(max, Number(c.voteCount || 0)),
      0
    );

    // Hitung persentase dan ranking
    let currentRank = 1;
    let prevVoteCount: number | null = null;
    let processedCount = 0;

    const candidateResults = candidateVotesRaw.map((cand) => {
      processedCount++;
      const vCount = Number(cand.voteCount || 0);

      if (prevVoteCount !== null && vCount < prevVoteCount) {
        currentRank = processedCount;
      }
      prevVoteCount = vCount;

      const percentage =
        totalVotes > 0 ? Number(((vCount / totalVotes) * 100).toFixed(1)) : 0;
      const isLeader = maxVotes > 0 && vCount === maxVotes;

      return {
        id: cand.id,
        candidateNumber: cand.candidateNumber,
        name: cand.name,
        classOrUnit: cand.classOrUnit,
        motto: cand.motto,
        photoUrl: cand.photoUrl,
        themeColor: cand.themeColor,
        voteCount: vCount,
        percentage,
        isLeader,
        rank: currentRank,
      };
    });

    const leaderCandidate = candidateResults.find((c) => c.isLeader);

    // 5. Partisipasi per rombel / kelas untuk laporan terintegrasi
    const classTurnoutRaw = await db
      .select({
        groupId: voterGroups.id,
        groupName: voterGroups.name,
        total: count(voters.id),
        voted: count(sql`CASE WHEN ${voters.hasVoted} = true THEN 1 END`),
      })
      .from(voterGroups)
      .leftJoin(voters, eq(voters.groupId, voterGroups.id))
      .where(eq(voterGroups.electionId, activeElection.id))
      .groupBy(voterGroups.id, voterGroups.name, voterGroups.sortOrder)
      .orderBy(voterGroups.sortOrder, voterGroups.name);

    const classTurnout = classTurnoutRaw.map((row) => {
      const gTotal = Number(row.total || 0);
      const gVoted = Number(row.voted || 0);
      const percentage =
        gTotal > 0 ? Number(((gVoted / gTotal) * 100).toFixed(1)) : 0;
      return {
        id: row.groupId,
        name: row.groupName,
        total: gTotal,
        voted: gVoted,
        percentage,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        election: {
          id: activeElection.id,
          slug: activeElection.slug,
          shortName: activeElection.shortName,
          title: activeElection.title,
          organizationName: activeElection.organizationName,
          status: activeElection.status,
          startAt: activeElection.startAt,
          endAt: activeElection.endAt,
        },
        kpis: {
          totalVotes,
          totalVoters,
          votedCount,
          unvotedCount,
          turnoutPercentage,
        },
        leader: leaderCandidate
          ? {
              candidateNumber: leaderCandidate.candidateNumber,
              name: leaderCandidate.name,
              voteCount: leaderCandidate.voteCount,
              percentage: leaderCandidate.percentage,
            }
          : null,
        candidates: candidateResults,
        classTurnout,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Gagal mengambil data hasil pemilihan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Terjadi kesalahan saat memuat hasil pemilihan.",
      },
      { status: 500 }
    );
  }
}
