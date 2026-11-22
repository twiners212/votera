import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { candidates, db, elections, electionSettings } from "@/db";
import { getVoterSession } from "@/lib/auth/voter-session";
import { CandidateDetailView } from "@/components/voter/candidate-detail-view";
import type { CandidateDTO, CandidateTheme, ElectionStatus } from "@/types/votera";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

const getActiveElectionWithCandidate = cache(async (candidateId: string) => {
  if (!UUID_REGEX.test(candidateId)) {
    return null;
  }

  const [row] = await db
    .select({
      electionId: elections.id,
      shortName: elections.shortName,
      title: elections.title,
      organizationName: elections.organizationName,
      status: elections.status,
      logoUrl: electionSettings.logoUrl,
      heroBannerUrl: electionSettings.heroBannerUrl,
      candidateId: candidates.id,
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
    .leftJoin(
      electionSettings,
      eq(electionSettings.electionId, elections.id)
    )
    .where(
      and(
        eq(candidates.id, candidateId),
        eq(candidates.isActive, true)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const candidate: CandidateDTO = {
    id: row.candidateId,
    electionId: row.electionId,
    candidateNumber: row.candidateNumber,
    name: row.name,
    classOrUnit: row.classOrUnit,
    motto: row.motto,
    vision: row.vision,
    missions: Array.isArray(row.missions) ? (row.missions as string[]) : [],
    programs: Array.isArray(row.programs) ? (row.programs as string[]) : [],
    supporters: Array.isArray(row.supporters)
      ? (row.supporters as string[])
      : [],
    photoUrl: row.photoUrl,
    themeColor: (row.themeColor as CandidateTheme) ?? "red",
    isActive: row.isActive,
  };

  return {
    election: {
      shortName: row.shortName,
      title: row.title,
      organizationName: row.organizationName,
      status: row.status as ElectionStatus,
      logoUrl: row.logoUrl ?? null,
      heroBannerUrl: row.heroBannerUrl ?? null,
    },
    candidate,
  };
});

export async function generateMetadata({
  params,
}: CandidateDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getActiveElectionWithCandidate(id);

  if (!data) {
    return {
      title: "Kandidat Tidak Ditemukan — Votera",
    };
  }

  return {
    title: `Kandidat #${data.candidate.candidateNumber} ${data.candidate.name} — ${data.election.shortName}`,
    description: `${data.candidate.motto} — Profil, visi, misi, dan program kerja ${data.candidate.name} (${data.candidate.classOrUnit}).`,
  };
}

export default async function CandidateDetailPage({
  params,
}: CandidateDetailPageProps) {
  const { id } = await params;
  const data = await getActiveElectionWithCandidate(id);

  if (!data) {
    notFound();
  }

  const voter = await getVoterSession();
  const hasVoterSession = Boolean(voter);

  return (
    <CandidateDetailView
      candidate={data.candidate}
      election={data.election}
      voter={voter}
      hasVoterSession={hasVoterSession}
    />
  );
}
