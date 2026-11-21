import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { candidates, db, elections, electionSettings } from "@/db";
import { getVoterSession } from "@/lib/auth/voter-session";
import { CandidateDetailView } from "@/components/voter/candidate-detail-view";
import type { CandidateDTO } from "@/types/votera";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

async function getActiveElectionWithCandidate(candidateId: string) {
  if (!UUID_REGEX.test(candidateId)) {
    return null;
  }

  const [electionRow] = await db
    .select({
      id: elections.id,
      shortName: elections.shortName,
      title: elections.title,
      organizationName: elections.organizationName,
      status: elections.status,
      logoUrl: electionSettings.logoUrl,
      heroBannerUrl: electionSettings.heroBannerUrl,
    })
    .from(elections)
    .leftJoin(electionSettings, eq(electionSettings.electionId, elections.id))
    .where(eq(elections.isActive, true))
    .orderBy(desc(elections.createdAt))
    .limit(1);

  if (!electionRow) {
    return null;
  }

  const [candidateRow] = await db
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
        eq(candidates.id, candidateId),
        eq(candidates.electionId, electionRow.id),
        eq(candidates.isActive, true)
      )
    )
    .limit(1);

  if (!candidateRow) {
    return null;
  }

  const candidate: CandidateDTO = {
    id: candidateRow.id,
    electionId: candidateRow.electionId,
    candidateNumber: candidateRow.candidateNumber,
    name: candidateRow.name,
    classOrUnit: candidateRow.classOrUnit,
    motto: candidateRow.motto,
    vision: candidateRow.vision,
    missions: Array.isArray(candidateRow.missions) ? candidateRow.missions : [],
    programs: Array.isArray(candidateRow.programs) ? candidateRow.programs : [],
    supporters: Array.isArray(candidateRow.supporters)
      ? candidateRow.supporters
      : [],
    photoUrl: candidateRow.photoUrl,
    themeColor: candidateRow.themeColor,
    isActive: candidateRow.isActive,
  };

  return {
    election: {
      shortName: electionRow.shortName,
      title: electionRow.title,
      organizationName: electionRow.organizationName,
      status: electionRow.status,
      logoUrl: electionRow.logoUrl ?? null,
      heroBannerUrl: electionRow.heroBannerUrl ?? null,
    },
    candidate,
  };
}

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
