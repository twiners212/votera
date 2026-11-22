import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { VoteThanksView } from "@/components/voter/vote-thanks-view";
import {
  db,
  elections,
  electionSettings,
} from "@/db";
import { getVoterSession } from "@/lib/auth/voter-session";
import type { ElectionStatus, VoterSessionDTO } from "@/types/votera";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suara Tercatat — Votera",
  description:
    "Konfirmasi suara kamu telah tercatat secara anonim dan dijaga kerahasiaannya.",
};

interface VoteThanksPageData {
  shortName: string;
  organizationName: string;
  title: string;
  status: ElectionStatus;
  logoUrl: string | null;
  heroBannerUrl: string | null;
  voter: VoterSessionDTO | null;
}

const DEFAULT_PAGE_DATA: VoteThanksPageData = {
  shortName: "PILKETOS 2026",
  organizationName: "SMA Bojong Gede",
  title: "Pemilihan Ketua OSIS 2026",
  status: "open",
  logoUrl: "/images/logo-default.png",
  heroBannerUrl: "/images/hero-flag-ballot.jpg",
  voter: null,
};

async function getVoteThanksPageData(
  voter: VoterSessionDTO
): Promise<VoteThanksPageData> {
  try {
    const [row] = await db
      .select({
        shortName: elections.shortName,
        title: elections.title,
        organizationName: elections.organizationName,
        status: elections.status,
        logoUrl: electionSettings.logoUrl,
        heroBannerUrl: electionSettings.heroBannerUrl,
      })
      .from(elections)
      .leftJoin(
        electionSettings,
        eq(electionSettings.electionId, elections.id)
      )
      .where(eq(elections.id, voter.electionId))
      .limit(1);

    return {
      shortName: row?.shortName ?? DEFAULT_PAGE_DATA.shortName,
      organizationName:
        row?.organizationName ?? DEFAULT_PAGE_DATA.organizationName,
      title: row?.title ?? DEFAULT_PAGE_DATA.title,
      status: row?.status ?? DEFAULT_PAGE_DATA.status,
      logoUrl: row?.logoUrl ?? DEFAULT_PAGE_DATA.logoUrl,
      heroBannerUrl: row?.heroBannerUrl ?? DEFAULT_PAGE_DATA.heroBannerUrl,
      voter,
    };
  } catch {
    return {
      ...DEFAULT_PAGE_DATA,
      voter,
    };
  }
}

export default async function VoteThanksPage() {
  const voter = await getVoterSession();

  if (!voter) {
    redirect("/login");
  }

  if (!voter.hasVoted) {
    redirect("/vote");
  }

  const data = await getVoteThanksPageData(voter);

  return (
    <VoteThanksView
      shortName={data.shortName}
      organizationName={data.organizationName}
      title={data.title}
      status={data.status}
      logoUrl={data.logoUrl}
      heroBannerUrl={data.heroBannerUrl}
      voter={data.voter}
    />
  );
}
