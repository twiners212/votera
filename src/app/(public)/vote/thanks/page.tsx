import crypto from "node:crypto";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { VoteThanksView } from "@/components/voter/vote-thanks-view";
import {
  db,
  elections,
  electionSettings,
  voterGroups,
  voters,
  voterSessions,
} from "@/db";
import type { ElectionStatus, VoterSessionDTO } from "@/types/votera";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suara Tercatat — Votera",
  description:
    "Konfirmasi suara kamu telah tercatat secara anonim dan dijaga kerahasiaannya.",
};

const VOTER_SESSION_COOKIE = "votera_voter_session";

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

async function getVoteThanksPageData(): Promise<VoteThanksPageData> {
  try {
    const [election] = await db
      .select({
        id: elections.id,
        shortName: elections.shortName,
        title: elections.title,
        organizationName: elections.organizationName,
        status: elections.status,
      })
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    const [settings] = election
      ? await db
          .select({
            logoUrl: electionSettings.logoUrl,
            heroBannerUrl: electionSettings.heroBannerUrl,
          })
          .from(electionSettings)
          .where(eq(electionSettings.electionId, election.id))
          .limit(1)
      : [undefined];

    let voter: VoterSessionDTO | null = null;
    const cookieStore = await cookies();
    const rawSessionToken = cookieStore.get(VOTER_SESSION_COOKIE)?.value;

    if (rawSessionToken) {
      const sessionTokenHash = crypto
        .createHash("sha256")
        .update(rawSessionToken)
        .digest("hex");

      const [sessionRow] = await db
        .select({
          id: voters.id,
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
            eq(voterSessions.sessionTokenHash, sessionTokenHash),
            gt(voterSessions.expiresAt, new Date())
          )
        )
        .limit(1);

      if (sessionRow) {
        voter = {
          id: sessionRow.id,
          electionId: sessionRow.electionId,
          name: sessionRow.name,
          voterIdentity: sessionRow.voterIdentity,
          groupId: sessionRow.groupId,
          groupName: sessionRow.groupName,
          hasVoted: sessionRow.hasVoted,
          votedAt: sessionRow.votedAt ? sessionRow.votedAt.toISOString() : null,
        };
      }
    }

    return {
      shortName: election?.shortName ?? DEFAULT_PAGE_DATA.shortName,
      organizationName:
        election?.organizationName ?? DEFAULT_PAGE_DATA.organizationName,
      title: election?.title ?? DEFAULT_PAGE_DATA.title,
      status: election?.status ?? DEFAULT_PAGE_DATA.status,
      logoUrl: settings?.logoUrl ?? DEFAULT_PAGE_DATA.logoUrl,
      heroBannerUrl: settings?.heroBannerUrl ?? DEFAULT_PAGE_DATA.heroBannerUrl,
      voter,
    };
  } catch {
    return DEFAULT_PAGE_DATA;
  }
}

export default async function VoteThanksPage() {
  const data = await getVoteThanksPageData();

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
