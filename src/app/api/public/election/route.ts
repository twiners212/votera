import { and, asc, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { candidates, db, elections } from "@/db";
import {
  formatErrorResponse,
  formatSuccessResponse,
} from "@/lib/admin/api-response";
import {
  checkPublicEndpointRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
  getClientIp,
} from "@/lib/rate-limit";
import type { CandidateDTO, CandidateTheme } from "@/types/votera";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse>;
export async function GET(): Promise<NextResponse>;
export async function GET(request?: Request): Promise<NextResponse> {
  try {
    const clientIp = request ? getClientIp(request) : "::1";
    const rateLimit = checkPublicEndpointRateLimit("public-election", clientIp);
    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        rateLimit,
        60,
        `Terlalu banyak permintaan informasi pemilihan. Silakan tunggu ${rateLimit.retryAfterSeconds} detik.`
      );
    }

    const [election] = await db
      .select({
        id: elections.id,
        slug: elections.slug,
        shortName: elections.shortName,
        title: elections.title,
        organizationName: elections.organizationName,
        description: elections.description,
        status: elections.status,
        startAt: elections.startAt,
        endAt: elections.endAt,
        isActive: elections.isActive,
        isWithinSchedule: sql<boolean>`
          ${elections.status} = 'open'
          AND ${elections.startAt} IS NOT NULL
          AND ${elections.endAt} IS NOT NULL
          AND now() >= ${elections.startAt}
          AND now() <= ${elections.endAt}
        `,
      })
      .from(elections)
      .where(eq(elections.isActive, true))
      .orderBy(desc(elections.createdAt))
      .limit(1);

    if (!election) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Pemilihan aktif tidak ditemukan.",
        404
      );
    }

    const activeCandidates = await db
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
          eq(candidates.electionId, election.id),
          eq(candidates.isActive, true)
        )
      )
      .orderBy(asc(candidates.candidateNumber));

    const candidateList: CandidateDTO[] = activeCandidates.map((c) => ({
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
      themeColor: (c.themeColor as CandidateTheme) ?? "red",
      isActive: c.isActive,
    }));

    return formatSuccessResponse(
      {
        election: {
          id: election.id,
          slug: election.slug,
          shortName: election.shortName,
          title: election.title,
          organizationName: election.organizationName,
          description: election.description,
          status: election.status,
          startAt: election.startAt ? election.startAt.toISOString() : null,
          endAt: election.endAt ? election.endAt.toISOString() : null,
          isActive: election.isActive,
          isWithinSchedule: Boolean(election.isWithinSchedule),
        },
        candidates: candidateList,
      },
      undefined,
      200,
      {
        "Cache-Control": "public, max-age=10",
        ...createRateLimitHeaders(rateLimit, 60),
      }
    );
  } catch (error) {
    console.error("Public election GET route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memuat data pemilihan publik.",
      500
    );
  }
}
