import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import { db } from "@/db";
import {
  elections,
  candidates,
  voters,
  votes,
  voterGroups,
  gradeLevels,
  majors,
  auditLogs,
} from "@/db/schema";
import {
  generateResultsWorkbookBuffer,
  sanitizeReportFilename,
} from "@/lib/reports/export-excel";
import { generateBeritaAcaraPdfBuffer } from "@/lib/reports/export-pdf";
import type {
  ElectionResultsDTO,
  CandidateResultDTO,
  GroupParticipationDTO,
  AuditLogDTO,
} from "@/types/votera";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1. Guard with admin session (committee or super_admin)
  const { errorResponse } = await requireAdminApiSession([
    "committee",
    "super_admin",
  ]);

  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") || "excel").toLowerCase();
  const electionIdParam = searchParams.get("electionId");

  try {
    // 2. Resolve target election
    let electionRecord;

    if (electionIdParam && electionIdParam !== "active") {
      const found = await db
        .select()
        .from(elections)
        .where(eq(elections.id, electionIdParam))
        .limit(1);
      electionRecord = found[0];
    } else {
      const foundActive = await db
        .select()
        .from(elections)
        .where(eq(elections.isActive, true))
        .limit(1);
      if (foundActive.length > 0) {
        electionRecord = foundActive[0];
      } else {
        const foundAny = await db.select().from(elections).limit(1);
        electionRecord = foundAny[0];
      }
    }

    if (!electionRecord) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Data pemilihan tidak ditemukan.",
          },
        },
        { status: 404 }
      );
    }

    const targetElectionId = electionRecord.id;

    // 3. Query active candidates
    const candidatesList = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, targetElectionId),
          eq(candidates.isActive, true)
        )
      )
      .orderBy(asc(candidates.candidateNumber));

    // 4. Query anonymous vote tallies per candidate
    const voteTally = await db
      .select({
        candidateId: votes.candidateId,
        voteCount: sql<number>`count(*)::int`,
      })
      .from(votes)
      .where(eq(votes.electionId, targetElectionId))
      .groupBy(votes.candidateId);

    const voteMap = new Map<string, number>();
    let totalVotesCast = 0;
    for (const v of voteTally) {
      voteMap.set(v.candidateId, v.voteCount);
      totalVotesCast += v.voteCount;
    }

    // 5. Calculate candidate rankings & percentages
    const candidateResults: CandidateResultDTO[] = candidatesList.map((c) => {
      const count = voteMap.get(c.id) || 0;
      const percentage =
        totalVotesCast > 0 ? (count / totalVotesCast) * 100 : 0;
      return {
        id: c.id,
        candidateNumber: c.candidateNumber,
        name: c.name,
        classOrUnit: c.classOrUnit,
        photoUrl: c.photoUrl,
        themeColor: c.themeColor,
        voteCount: count,
        percentage,
        rank: 1,
      };
    });

    const sortedByVotes = [...candidateResults].sort(
      (a, b) => b.voteCount - a.voteCount || a.candidateNumber - b.candidateNumber
    );

    let currentRank = 1;
    for (let i = 0; i < sortedByVotes.length; i++) {
      if (i > 0 && sortedByVotes[i].voteCount < sortedByVotes[i - 1].voteCount) {
        currentRank = i + 1;
      }
      sortedByVotes[i].rank = currentRank;
    }

    let leadingCandidate: {
      candidateNumber: number;
      name: string;
      isTie: boolean;
    } | null = null;

    if (sortedByVotes.length > 0 && totalVotesCast > 0) {
      const top1 = sortedByVotes[0];
      const isTie =
        sortedByVotes.length > 1 &&
        sortedByVotes[1].voteCount === top1.voteCount;
      leadingCandidate = {
        candidateNumber: top1.candidateNumber,
        name: top1.name,
        isTie,
      };
    }

    // 6. Query voter stats
    const voterStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        voted: sql<number>`count(*) filter (where ${voters.hasVoted} = true)::int`,
      })
      .from(voters)
      .where(eq(voters.electionId, targetElectionId));

    const totalVoters = voterStats[0]?.total || 0;
    const votesCast = totalVotesCast;
    const notVoted = Math.max(0, totalVoters - votesCast);
    const turnoutPercentage =
      totalVoters > 0 ? (votesCast / totalVoters) * 100 : 0;

    // 7. Query group participation
    const groupRows = await db
      .select({
        groupId: voterGroups.id,
        groupName: voterGroups.name,
        gradeName: gradeLevels.name,
        majorName: majors.name,
        totalMembers: sql<number>`count(${voters.id})::int`,
        votedMembers: sql<number>`count(${voters.id}) filter (where ${voters.hasVoted} = true)::int`,
      })
      .from(voterGroups)
      .leftJoin(gradeLevels, eq(voterGroups.gradeLevelId, gradeLevels.id))
      .leftJoin(majors, eq(voterGroups.majorId, majors.id))
      .leftJoin(
        voters,
        and(
          eq(voters.groupId, voterGroups.id),
          eq(voters.electionId, targetElectionId)
        )
      )
      .where(eq(voterGroups.electionId, targetElectionId))
      .groupBy(
        voterGroups.id,
        voterGroups.name,
        gradeLevels.name,
        majors.name,
        voterGroups.sortOrder
      )
      .orderBy(asc(voterGroups.sortOrder), asc(voterGroups.name));

    const groupParticipation: GroupParticipationDTO[] = groupRows.map((g) => ({
      groupId: g.groupId,
      groupName: g.groupName,
      gradeName: g.gradeName,
      majorName: g.majorName,
      totalMembers: g.totalMembers,
      votedMembers: g.votedMembers,
      percentage:
        g.totalMembers > 0 ? (g.votedMembers / g.totalMembers) * 100 : 0,
    }));

    // 8. Query recent audit logs for Excel Sheet 4
    const logsList = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.electionId, targetElectionId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    const formattedLogs: AuditLogDTO[] = logsList.map((log) => ({
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

    // 9. Build ElectionResultsDTO
    const resultsDTO: ElectionResultsDTO = {
      election: {
        id: electionRecord.id,
        shortName: electionRecord.shortName,
        title: electionRecord.title,
        organizationName: electionRecord.organizationName,
        status: electionRecord.status,
        startAt: electionRecord.startAt
          ? electionRecord.startAt.toISOString()
          : null,
        endAt: electionRecord.endAt ? electionRecord.endAt.toISOString() : null,
      },
      summary: {
        totalVoters,
        votesCast,
        notVoted,
        turnoutPercentage,
      },
      leadingCandidate,
      candidates: sortedByVotes,
      groupParticipation,
      lastUpdatedAt: new Date().toISOString(),
    };

    const slug = sanitizeReportFilename(
      resultsDTO.election.shortName || resultsDTO.election.title
    );

    // 10. Format binary response
    if (format === "pdf") {
      const pdfBuffer = generateBeritaAcaraPdfBuffer(resultsDTO);
      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="berita-acara-${slug}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Default: Excel workbook
    const excelBuffer = generateResultsWorkbookBuffer(resultsDTO, formattedLogs);
    return new NextResponse(excelBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="hasil-pemilihan-${slug}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal mengekspor laporan pemilihan.";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
