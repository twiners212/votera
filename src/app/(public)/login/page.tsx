import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, elections } from "@/db";
import { getVoterSession } from "@/lib/auth/voter-session";
import { VoterLoginForm } from "@/components/voter/voter-login-form";
import type { ElectionStatus } from "@/types/votera";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk untuk Memilih — Votera",
  description:
    "Masuk menggunakan identitas pemilih dan token resmi untuk memberikan suara Anda.",
};

interface ActiveElectionLoginConfig {
  electionId?: string;
  idLabel: string;
  shortName: string;
  title: string;
  organizationName: string;
  status: ElectionStatus;
  logoUrl: string | null;
  heroBannerUrl: string | null;
}

const DEFAULT_LOGIN_CONFIG: ActiveElectionLoginConfig = {
  idLabel: "NIS",
  shortName: "PILKETOS 2026",
  title: "Pemilihan Ketua OSIS 2026",
  organizationName: "SMA Bojong Gede",
  status: "open",
  logoUrl: null,
  heroBannerUrl: null,
};

async function getActiveElectionLoginConfig(): Promise<ActiveElectionLoginConfig> {
  try {
    const activeElection = await db.query.elections.findFirst({
      where: eq(elections.isActive, true),
      orderBy: [desc(elections.createdAt)],
      with: {
        settings: true,
      },
    });

    if (!activeElection) {
      return DEFAULT_LOGIN_CONFIG;
    }

    return {
      electionId: activeElection.id,
      idLabel:
        activeElection.settings?.idLabel?.trim() ||
        DEFAULT_LOGIN_CONFIG.idLabel,
      shortName: activeElection.shortName || DEFAULT_LOGIN_CONFIG.shortName,
      title: activeElection.title || DEFAULT_LOGIN_CONFIG.title,
      organizationName:
        activeElection.organizationName ||
        DEFAULT_LOGIN_CONFIG.organizationName,
      status: activeElection.status,
      logoUrl: activeElection.settings?.logoUrl ?? null,
      heroBannerUrl: activeElection.settings?.heroBannerUrl ?? null,
    };
  } catch {
    return DEFAULT_LOGIN_CONFIG;
  }
}

export default async function VoterLoginPage() {
  const [voter, config] = await Promise.all([
    getVoterSession(),
    getActiveElectionLoginConfig(),
  ]);

  if (voter) {
    if (voter.hasVoted) {
      redirect("/vote/thanks");
    }
    if (!config.electionId || voter.electionId === config.electionId) {
      redirect("/vote");
    }
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-[#F8FAFC] p-0 sm:p-4 lg:p-8">
      <VoterLoginForm
        electionId={config.electionId}
        idLabel={config.idLabel}
        shortName={config.shortName}
        title={config.title}
        organizationName={config.organizationName}
        status={config.status}
        logoUrl={config.logoUrl}
        heroBannerUrl={config.heroBannerUrl}
      />
    </main>
  );
}
