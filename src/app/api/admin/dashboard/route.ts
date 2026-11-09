import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  elections,
  candidates,
  voters,
  voterGroups,
  auditLogs,
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

    // 2. Hitung jumlah kandidat aktif
    const [candidateStats] = await db
      .select({ total: count() })
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, activeElection.id),
          eq(candidates.isActive, true)
        )
      );
    const candidateCount = Number(candidateStats?.total || 0);

    // 3. Hitung total DPT dan jumlah yang sudah/belum memilih
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

    // 4. Hitung partisipasi per rombel / kelas
    const classParticipationRaw = await db
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

    const classParticipation = classParticipationRaw.map((row) => {
      const groupTotal = Number(row.total || 0);
      const groupVoted = Number(row.voted || 0);
      const percentage =
        groupTotal > 0 ? Number(((groupVoted / groupTotal) * 100).toFixed(1)) : 0;
      return {
        id: row.groupId,
        name: row.groupName,
        total: groupTotal,
        voted: groupVoted,
        percentage,
      };
    });

    // 5. Kesiapan Pemilihan (Checklist)
    const hasMinCandidates = candidateCount >= 2;
    const hasVoters = totalVoters > 0;
    const hasSchedule = Boolean(activeElection.startAt && activeElection.endAt);
    const hasOrganization = Boolean(activeElection.organizationName?.trim());
    const isReady =
      hasMinCandidates && hasVoters && hasSchedule && hasOrganization;

    // 6. Aktivitas Terbaru (Audit Logs)
    const recentLogsRaw = await db
      .select({
        id: auditLogs.id,
        actorType: auditLogs.actorType,
        actorName: auditLogs.actorName,
        actorIdentity: auditLogs.actorIdentity,
        action: auditLogs.action,
        actionTitle: auditLogs.actionTitle,
        description: auditLogs.description,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.electionId, activeElection.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(5);

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
          candidateCount,
          totalVoters,
          votedCount,
          unvotedCount,
          turnoutPercentage,
        },
        classParticipation,
        readiness: {
          isReady,
          hasMinCandidates,
          candidateCount,
          hasVoters,
          totalVoters,
          hasSchedule,
          hasOrganization,
          organizationName: activeElection.organizationName,
        },
        recentActivities: recentLogsRaw,
      },
    });
  } catch (error) {
    console.error("Gagal mengambil data dashboard admin:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Terjadi kesalahan saat memuat dashboard admin.",
      },
      { status: 500 }
    );
  }
}
