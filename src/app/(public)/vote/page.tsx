import crypto from "node:crypto";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, gt } from "drizzle-orm";
import {
  db,
  candidates,
  elections,
  electionSettings,
  voterGroups,
  voters,
  voterSessions,
} from "@/db";
import { PublicNavbar } from "@/components/voter/public-navbar";
import {
  BallotWorkspace,
  type BallotElectionSummary,
} from "@/components/voter/ballot-workspace";
import type { CandidateDTO, VoterSessionDTO } from "@/types/votera";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Surat Suara — Votera",
  description:
    "Pilih satu calon ketua pada surat suara elektronik Votera secara rahasia dan aman.",
};

interface BallotPageData {
  election: BallotElectionSummary | null;
  logoUrl: string | null;
  candidates: CandidateDTO[];
  isVotingOpen: boolean;
  voter: VoterSessionDTO | null;
}

async function getVoterFromCookie(
  electionId: string
): Promise<VoterSessionDTO | null> {
  try {
    const cookieStore = await cookies();
    const rawSessionToken = cookieStore.get("votera_voter_session")?.value;
    if (!rawSessionToken) {
      return null;
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawSessionToken)
      .digest("hex");

    const now = new Date();
    const [sessionRow] = await db
      .select({
        voterId: voters.id,
        electionId: voters.electionId,
        name: voters.name,
        voterIdentity: voters.voterIdentity,
        groupId: voters.groupId,
        groupName: voterGroups.name,
        hasVoted: voters.hasVoted,
        votedAt: voters.votedAt,
      })
      .from(voterSessions)
      .innerJoin(voters, eq(voterSessions.voterId, voters.id))
      .innerJoin(voterGroups, eq(voters.groupId, voterGroups.id))
      .where(
        and(
          eq(voterSessions.sessionTokenHash, tokenHash),
          eq(voterSessions.electionId, electionId),
          gt(voterSessions.expiresAt, now)
        )
      )
      .limit(1);

    if (!sessionRow) {
      return null;
    }

    return {
      id: sessionRow.voterId,
      electionId: sessionRow.electionId,
      name: sessionRow.name,
      voterIdentity: sessionRow.voterIdentity,
      groupId: sessionRow.groupId,
      groupName: sessionRow.groupName,
      hasVoted: sessionRow.hasVoted,
      votedAt: sessionRow.votedAt ? sessionRow.votedAt.toISOString() : null,
    };
  } catch {
    return null;
  }
}

async function loadBallotPageData(): Promise<BallotPageData> {
  try {
    const [activeElection] = await db
      .select({
        id: elections.id,
        shortName: elections.shortName,
        title: elections.title,
        organizationName: elections.organizationName,
        status: elections.status,
        startAt: elections.startAt,
        endAt: elections.endAt,
        logoUrl: electionSettings.logoUrl,
        heroBannerUrl: electionSettings.heroBannerUrl,
      })
      .from(elections)
      .leftJoin(electionSettings, eq(electionSettings.electionId, elections.id))
      .where(eq(elections.isActive, true))
      .limit(1);

    if (!activeElection) {
      return {
        election: null,
        logoUrl: null,
        candidates: [],
        isVotingOpen: false,
        voter: null,
      };
    }

    const [activeCandidates, voter] = await Promise.all([
      db
        .select({
          id: candidates.id,
          electionId: candidates.electionId,
          candidateNumber: candidates.candidateNumber,
          name: candidates.name,
          classOrUnit: candidates.classOrUnit,
          motto: candidates.motto,
          vision: candidates.vision,
          missions: candidates.missions,
          programs: candidates.programs,
          supporters: candidates.supporters,
          photoUrl: candidates.photoUrl,
          themeColor: candidates.themeColor,
          isActive: candidates.isActive,
        })
        .from(candidates)
        .where(
          and(
            eq(candidates.electionId, activeElection.id),
            eq(candidates.isActive, true)
          )
        )
        .orderBy(asc(candidates.candidateNumber)),
      getVoterFromCookie(activeElection.id),
    ]);

    const now = new Date();
    const withinSchedule =
      (!activeElection.startAt || now >= activeElection.startAt) &&
      (!activeElection.endAt || now <= activeElection.endAt);
    const isVotingOpen = activeElection.status === "open" && withinSchedule;

    return {
      election: {
        id: activeElection.id,
        shortName: activeElection.shortName,
        title: activeElection.title,
        organizationName: activeElection.organizationName,
        status: activeElection.status,
        heroBannerUrl: activeElection.heroBannerUrl,
      },
      logoUrl: activeElection.logoUrl,
      candidates: activeCandidates.map((c) => ({
        id: c.id,
        electionId: c.electionId,
        candidateNumber: c.candidateNumber,
        name: c.name,
        classOrUnit: c.classOrUnit,
        motto: c.motto,
        vision: c.vision,
        missions: Array.isArray(c.missions) ? c.missions : [],
        programs: Array.isArray(c.programs) ? c.programs : [],
        supporters: Array.isArray(c.supporters) ? c.supporters : [],
        photoUrl: c.photoUrl,
        themeColor: c.themeColor,
        isActive: c.isActive,
      })),
      isVotingOpen,
      voter,
    };
  } catch {
    return {
      election: null,
      logoUrl: null,
      candidates: [],
      isVotingOpen: false,
      voter: null,
    };
  }
}

export default async function BallotVotePage() {
  const { election, logoUrl, candidates: candidateList, isVotingOpen, voter } =
    await loadBallotPageData();

  if (voter?.hasVoted) {
    redirect("/vote/thanks");
  }

  return (
    <>
      <PublicNavbar
        shortName={election?.shortName}
        organizationName={election?.organizationName}
        logoUrl={logoUrl}
        status={election?.status ?? "draft"}
        statusLabel={
          isVotingOpen
            ? "Pemungutan suara dibuka"
            : election?.status === "open"
              ? "Di luar jadwal"
              : undefined
        }
        voter={voter}
      />
      <BallotWorkspace
        election={election}
        candidates={candidateList}
        isVotingOpen={isVotingOpen}
      />
    </>
  );
}
