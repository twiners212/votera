import { cache } from "react";
import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import { and, asc, desc, eq } from "drizzle-orm";
import { candidates, db, elections, electionSettings } from "@/db";
import type { CandidateDTO, CandidateTheme, ElectionStatus } from "@/types/votera";

export interface PublicShowcaseData {
  id: string;
  shortName: string;
  title: string;
  organizationName: string;
  description: string | null;
  status: ElectionStatus;
  logoUrl: string;
  heroBannerUrl: string;
  candidates: CandidateDTO[];
}

export const DEFAULT_SHOWCASE_DATA: PublicShowcaseData = {
  id: "active",
  shortName: "PILKETOS 2026",
  title: "Pemilihan Ketua OSIS 2026",
  organizationName: "SMA Bojong Gede",
  description:
    "Kenali calon ketua sebelum menentukan pilihan. Suara kamu dijaga kerahasiaannya dan hanya bisa digunakan satu kali.",
  status: "draft",
  logoUrl: "/images/logo-default.png",
  heroBannerUrl: "/images/hero-flag-ballot.jpg",
  candidates: [],
};

async function queryPublicShowcaseData(): Promise<PublicShowcaseData> {
  try {
    const [[electionWithSettings], rawCandidates] = await Promise.all([
      db
        .select({
          id: elections.id,
          shortName: elections.shortName,
          title: elections.title,
          organizationName: elections.organizationName,
          description: elections.description,
          status: elections.status,
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

    if (!electionWithSettings) {
      return DEFAULT_SHOWCASE_DATA;
    }

    const activeCandidates = rawCandidates.filter(
      (item) => item.electionId === electionWithSettings.id
    );

    return {
      id: electionWithSettings.id,
      shortName: electionWithSettings.shortName,
      title: electionWithSettings.title,
      organizationName: electionWithSettings.organizationName,
      description: electionWithSettings.description,
      status: electionWithSettings.status,
      logoUrl:
        electionWithSettings.logoUrl?.trim() || "/images/logo-default.png",
      heroBannerUrl:
        electionWithSettings.heroBannerUrl?.trim() ||
        "/images/hero-flag-ballot.jpg",
      candidates: activeCandidates.map((item) => ({
        ...item,
        themeColor: (item.themeColor as CandidateTheme) ?? "red",
        missions: Array.isArray(item.missions) ? item.missions : [],
        programs: Array.isArray(item.programs) ? item.programs : [],
        supporters: Array.isArray(item.supporters) ? item.supporters : [],
      })),
    };
  } catch {
    return DEFAULT_SHOWCASE_DATA;
  }
}

const getCachedPublicShowcase = unstable_cache(
  async () => queryPublicShowcaseData(),
  ["public-showcase-data"],
  {
    revalidate: 15,
    tags: [
      "public-showcase",
      "candidates",
      "election-settings",
      "election-active",
      "elections",
    ],
  }
);

export const getPublicShowcaseDataCached = cache(
  async (): Promise<PublicShowcaseData> => {
    try {
      return await getCachedPublicShowcase();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("incrementalCache") ||
        message.includes("unstable_cache")
      ) {
        return queryPublicShowcaseData();
      }
      throw error;
    }
  }
);

export function revalidatePublicShowcase(): void {
  try {
    revalidateTag("public-showcase");
    revalidateTag("candidates");
    revalidateTag("election-settings");
    revalidateTag("election-active");
    revalidateTag("elections");
    revalidatePath("/");
    revalidatePath("/candidates");
  } catch {
    // In Vitest or non-Next.js runtime, revalidateTag is safely caught
  }
}
