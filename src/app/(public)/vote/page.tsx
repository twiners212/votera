import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  candidates,
  elections,
  electionSettings,
} from "@/db";
import { getVoterSession } from "@/lib/auth/voter-session";
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

async function loadBallotPageData(): Promise<BallotPageData> {
  try {
    const [voter, [activeElection], rawCandidates] = await Promise.all([
      getVoterSession(),
      db
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
        .leftJoin(
          electionSettings,
          eq(electionSettings.electionId, elections.id)
        )
        .where(eq(elections.isActive, true))
        .orderBy(desc(elections.createdAt))
        .limit(1),
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
        .innerJoin(
          elections,
          and(
            eq(candidates.electionId, elections.id),
            eq(elections.isActive, true)
          )
        )
        .where(eq(candidates.isActive, true))
        .orderBy(asc(candidates.candidateNumber)),
    ]);

    if (!activeElection) {
      return {
        election: null,
        logoUrl: null,
        candidates: [],
        isVotingOpen: false,
        voter,
      };
    }

    const activeCandidates = rawCandidates.filter(
      (c) => c.electionId === activeElection.id
    );

    const now = new Date();
    const withinSchedule =
      Boolean(activeElection.startAt && activeElection.endAt) &&
      now >= activeElection.startAt! &&
      now <= activeElection.endAt!;
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

  if (!voter) {
    redirect("/login");
  }

  if (voter.hasVoted) {
    redirect("/vote/thanks");
  }

  if (election && voter.electionId !== election.id) {
    redirect("/login");
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
