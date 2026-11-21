import { unstable_cache, revalidateTag } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  auditLogs,
  candidates,
  db,
  electionSettings,
  elections,
  gradeLevels,
  majors,
  voterGroups,
  voters,
  votes,
} from "@/db";
import type {
  AuditLogDTO,
  CandidateResultDTO,
  CandidateTheme,
  DashboardStatsDTO,
  ElectionResultsDTO,
  GroupParticipationDTO,
} from "@/types/votera";

export async function queryDashboardStats(
  electionId: string
): Promise<DashboardStatsDTO | null> {
  const [election] = await db
    .select()
    .from(elections)
    .where(eq(elections.id, electionId))
    .limit(1);

  if (!election) {
    return null;
  }

  const [settings] = await db
    .select()
    .from(electionSettings)
    .where(eq(electionSettings.electionId, electionId))
    .limit(1);

  const [candidateCountRow] = await db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(candidates)
    .where(
      and(eq(candidates.electionId, electionId), eq(candidates.isActive, true))
    );

  const activeCandidates = candidateCountRow?.count ?? 0;

  const [voterStatsRow] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      voted: sql<number>`cast(count(*) filter (where ${voters.hasVoted} = true) as int)`,
    })
    .from(voters)
    .where(eq(voters.electionId, electionId));

  const totalVoters = voterStatsRow?.total ?? 0;
  const votesCast = voterStatsRow?.voted ?? 0;
  const notVoted = Math.max(0, totalVoters - votesCast);
  const turnoutPercentage =
    totalVoters > 0 ? Number(((votesCast / totalVoters) * 100).toFixed(1)) : 0;

  const groupsWithDetails = await db
    .select({
      groupId: voterGroups.id,
      groupName: voterGroups.name,
      gradeName: gradeLevels.name,
      majorName: majors.name,
      sortOrder: voterGroups.sortOrder,
      totalMembers: sql<number>`cast(count(${voters.id}) as int)`,
      votedMembers: sql<number>`cast(count(${voters.id}) filter (where ${voters.hasVoted} = true) as int)`,
    })
    .from(voterGroups)
    .leftJoin(gradeLevels, eq(voterGroups.gradeLevelId, gradeLevels.id))
    .leftJoin(majors, eq(voterGroups.majorId, majors.id))
    .leftJoin(
      voters,
      and(
        eq(voterGroups.id, voters.groupId),
        eq(voters.electionId, electionId)
      )
    )
    .where(eq(voterGroups.electionId, electionId))
    .groupBy(
      voterGroups.id,
      voterGroups.name,
      gradeLevels.name,
      majors.name,
      voterGroups.sortOrder
    )
    .orderBy(voterGroups.sortOrder, voterGroups.name);

  const groupParticipation: GroupParticipationDTO[] = groupsWithDetails.map(
    (g) => {
      const total = g.totalMembers;
      const voted = g.votedMembers;
      const percentage =
        total > 0 ? Number(((voted / total) * 100).toFixed(1)) : 0;
      return {
        groupId: g.groupId,
        groupName: g.groupName,
        gradeName: g.gradeName ?? null,
        majorName: g.majorName ?? null,
        totalMembers: total,
        votedMembers: voted,
        percentage,
      };
    }
  );

  const hasMinTwoActiveCandidates = activeCandidates >= 2;
  const hasVotersRegistered = totalVoters > 0;
  const hasScheduleConfigured = Boolean(election.startAt && election.endAt);
  const hasOrganizationName = Boolean(
    election.organizationName && election.organizationName.trim().length > 0
  );
  const isReady =
    hasMinTwoActiveCandidates &&
    hasVotersRegistered &&
    hasScheduleConfigured &&
    hasOrganizationName;

  const recentLogs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.electionId, electionId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(5);

  const recentActivities: AuditLogDTO[] = recentLogs.map((log) => ({
    id: log.id,
    electionId: log.electionId,
    actorType: log.actorType,
    actorId: log.actorId,
    actorName: log.actorName,
    actorIdentity: log.actorIdentity,
    action: log.action,
    actionTitle: log.actionTitle,
    description: log.description,
    ipAddress: log.ipAddress,
    createdAt: log.createdAt.toISOString(),
  }));

  return {
    election: {
      id: election.id,
      shortName: election.shortName,
      title: election.title,
      organizationName: election.organizationName,
      status: election.status,
      startAt: election.startAt ? election.startAt.toISOString() : null,
      endAt: election.endAt ? election.endAt.toISOString() : null,
      settings: {
        idLabel: settings?.idLabel ?? "NIS",
        groupLabel: settings?.groupLabel ?? "Rombel",
        gradeLabel: settings?.gradeLabel ?? "Tingkat",
        majorLabel: settings?.majorLabel ?? "Jurusan",
        isResultPublic: settings?.isResultPublic ?? false,
        logoUrl: settings?.logoUrl ?? null,
        heroBannerUrl: settings?.heroBannerUrl ?? null,
      },
    },
    summary: {
      activeCandidates,
      totalVoters,
      votesCast,
      notVoted,
      turnoutPercentage,
    },
    groupParticipation,
    readiness: {
      isReady,
      checks: {
        hasMinTwoActiveCandidates,
        hasVotersRegistered,
        hasScheduleConfigured,
        hasOrganizationName,
      },
    },
    recentActivities,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export async function queryElectionResults(
  electionId: string
): Promise<ElectionResultsDTO | null> {
  const [election] = await db
    .select()
    .from(elections)
    .where(eq(elections.id, electionId))
    .limit(1);

  if (!election) {
    return null;
  }

  const [voterStatsRow] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      voted: sql<number>`cast(count(*) filter (where ${voters.hasVoted} = true) as int)`,
    })
    .from(voters)
    .where(eq(voters.electionId, electionId));

  const totalVoters = voterStatsRow?.total ?? 0;
  const votesCast = voterStatsRow?.voted ?? 0;
  const notVoted = Math.max(0, totalVoters - votesCast);
  const turnoutPercentage =
    totalVoters > 0 ? Number(((votesCast / totalVoters) * 100).toFixed(1)) : 0;

  // Query candidate vote counts strictly using COUNT - zero individual vote exposure
  const candidateRows = await db
    .select({
      id: candidates.id,
      candidateNumber: candidates.candidateNumber,
      name: candidates.name,
      classOrUnit: candidates.classOrUnit,
      photoUrl: candidates.photoUrl,
      themeColor: candidates.themeColor,
      isActive: candidates.isActive,
      voteCount: sql<number>`cast(count(${votes.id}) as int)`,
    })
    .from(candidates)
    .leftJoin(votes, eq(candidates.id, votes.candidateId))
    .where(eq(candidates.electionId, electionId))
    .groupBy(
      candidates.id,
      candidates.candidateNumber,
      candidates.name,
      candidates.classOrUnit,
      candidates.photoUrl,
      candidates.themeColor,
      candidates.isActive
    )
    .orderBy(desc(sql`count(${votes.id})`), candidates.candidateNumber);

  const totalCandidateVotes = candidateRows.reduce(
    (sum, c) => sum + c.voteCount,
    0
  );

  let currentRank = 1;
  const candidateResults: CandidateResultDTO[] = candidateRows.map(
    (c, index) => {
      if (index > 0 && c.voteCount < candidateRows[index - 1].voteCount) {
        currentRank = index + 1;
      }

      const percentage =
        totalCandidateVotes > 0
          ? Number(((c.voteCount / totalCandidateVotes) * 100).toFixed(1))
          : 0;

      return {
        id: c.id,
        candidateNumber: c.candidateNumber,
        name: c.name,
        classOrUnit: c.classOrUnit,
        photoUrl: c.photoUrl,
        themeColor: (c.themeColor as CandidateTheme) ?? "red",
        voteCount: c.voteCount,
        percentage,
        rank: currentRank,
      };
    }
  );

  let leadingCandidate: ElectionResultsDTO["leadingCandidate"] = null;
  if (totalCandidateVotes > 0 && candidateResults.length > 0) {
    const topVote = candidateResults[0].voteCount;
    const isTie =
      candidateResults.length > 1 &&
      candidateResults[1].voteCount === topVote &&
      topVote > 0;

    leadingCandidate = {
      candidateNumber: candidateResults[0].candidateNumber,
      name: candidateResults[0].name,
      isTie,
    };
  }

  const groupsWithDetails = await db
    .select({
      groupId: voterGroups.id,
      groupName: voterGroups.name,
      gradeName: gradeLevels.name,
      majorName: majors.name,
      sortOrder: voterGroups.sortOrder,
      totalMembers: sql<number>`cast(count(${voters.id}) as int)`,
      votedMembers: sql<number>`cast(count(${voters.id}) filter (where ${voters.hasVoted} = true) as int)`,
    })
    .from(voterGroups)
    .leftJoin(gradeLevels, eq(voterGroups.gradeLevelId, gradeLevels.id))
    .leftJoin(majors, eq(voterGroups.majorId, majors.id))
    .leftJoin(
      voters,
      and(
        eq(voterGroups.id, voters.groupId),
        eq(voters.electionId, electionId)
      )
    )
    .where(eq(voterGroups.electionId, electionId))
    .groupBy(
      voterGroups.id,
      voterGroups.name,
      gradeLevels.name,
      majors.name,
      voterGroups.sortOrder
    )
    .orderBy(voterGroups.sortOrder, voterGroups.name);

  const groupParticipation: GroupParticipationDTO[] = groupsWithDetails.map(
    (g) => {
      const total = g.totalMembers;
      const voted = g.votedMembers;
      const percentage =
        total > 0 ? Number(((voted / total) * 100).toFixed(1)) : 0;
      return {
        groupId: g.groupId,
        groupName: g.groupName,
        gradeName: g.gradeName ?? null,
        majorName: g.majorName ?? null,
        totalMembers: total,
        votedMembers: voted,
        percentage,
      };
    }
  );

  return {
    election: {
      id: election.id,
      shortName: election.shortName,
      title: election.title,
      organizationName: election.organizationName,
      status: election.status,
      startAt: election.startAt ? election.startAt.toISOString() : null,
      endAt: election.endAt ? election.endAt.toISOString() : null,
    },
    summary: {
      totalVoters,
      votesCast,
      notVoted,
      turnoutPercentage,
    },
    leadingCandidate,
    candidates: candidateResults,
    groupParticipation,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export async function getCachedDashboardStats(
  electionId: string
): Promise<DashboardStatsDTO | null> {
  try {
    return await unstable_cache(
      async () => queryDashboardStats(electionId),
      ["admin-dashboard", electionId],
      {
        revalidate: 3,
        tags: ["election-dashboard", `election-dashboard:${electionId}`],
      }
    )();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    if (
      message.includes("incrementalCache") ||
      message.includes("unstable_cache")
    ) {
      return queryDashboardStats(electionId);
    }
    throw error;
  }
}

export async function getCachedElectionResults(
  electionId: string
): Promise<ElectionResultsDTO | null> {
  try {
    return await unstable_cache(
      async () => queryElectionResults(electionId),
      ["admin-results", electionId],
      {
        revalidate: 3,
        tags: ["election-results", `election-results:${electionId}`],
      }
    )();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    if (
      message.includes("incrementalCache") ||
      message.includes("unstable_cache")
    ) {
      return queryElectionResults(electionId);
    }
    throw error;
  }
}

export function revalidateElectionCaches(electionId?: string): void {
  try {
    revalidateTag("election-dashboard");
    revalidateTag("election-results");
    if (electionId) {
      revalidateTag(`election-dashboard:${electionId}`);
      revalidateTag(`election-results:${electionId}`);
    }
  } catch {
    // In Vitest or non-Next.js runtime, revalidateTag is safely caught
  }
}
