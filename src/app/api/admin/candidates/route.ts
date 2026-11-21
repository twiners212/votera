import { NextRequest } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { candidates, db, votes } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { revalidateElectionCaches } from "@/lib/admin/cached-aggregations";
import { candidateSchema } from "@/lib/validations/candidate";
import { insertAuditLog } from "@/lib/audit";
import type { CandidateDTO, CandidateTheme } from "@/types/votera";

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAdminApiSession([
      "committee",
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const electionRef = searchParams.get("electionId");

    const election = await resolveTargetElection(electionRef);
    if (!election) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Data pemilihan tidak ditemukan.",
        404
      );
    }

    const rows = await db
      .select({
        candidate: candidates,
        votesCount: sql<number>`cast(count(${votes.id}) as int)`,
      })
      .from(candidates)
      .leftJoin(votes, eq(votes.candidateId, candidates.id))
      .where(eq(candidates.electionId, election.id))
      .groupBy(candidates.id)
      .orderBy(asc(candidates.candidateNumber));

    const candidateList: CandidateDTO[] = rows.map(
      ({ candidate: c, votesCount }) => ({
        id: c.id,
        electionId: c.electionId,
        candidateNumber: c.candidateNumber,
        name: c.name,
        classOrUnit: c.classOrUnit,
        motto: c.motto,
        vision: c.vision,
        missions: (c.missions as string[]) ?? [],
        programs: (c.programs as string[]) ?? [],
        supporters: (c.supporters as string[]) ?? [],
        photoUrl: c.photoUrl,
        themeColor: (c.themeColor as CandidateTheme) ?? "red",
        isActive: c.isActive,
        votesCount: Number(votesCount) || 0,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })
    );

    return formatSuccessResponse(candidateList);
  } catch (error) {
    console.error("Candidates GET route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memuat daftar kandidat.",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse("VALIDATION_ERROR", "Payload JSON tidak valid.", 400);
    }

    const parsed = candidateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    const election = await resolveTargetElection(parsed.data.electionId);
    if (!election) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Data pemilihan tidak ditemukan.",
        404
      );
    }

    // Check duplicate candidateNumber
    const [existingNumber] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, election.id),
          eq(candidates.candidateNumber, parsed.data.candidateNumber)
        )
      )
      .limit(1);

    if (existingNumber) {
      return formatErrorResponse(
        "CONFLICT",
        `Nomor urut ${parsed.data.candidateNumber} sudah digunakan oleh kandidat lain dalam pemilihan ini.`,
        409
      );
    }

    const [created] = await db
      .insert(candidates)
      .values({
        electionId: election.id,
        candidateNumber: parsed.data.candidateNumber,
        name: parsed.data.name,
        classOrUnit: parsed.data.classOrUnit,
        motto: parsed.data.motto,
        vision: parsed.data.vision,
        missions: parsed.data.missions,
        programs: parsed.data.programs,
        supporters: parsed.data.supporters,
        photoUrl: parsed.data.photoUrl ?? null,
        themeColor: parsed.data.themeColor,
        isActive: parsed.data.isActive,
      })
      .returning();

    await insertAuditLog({
      electionId: election.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "candidate_created",
      actionTitle: "Kandidat ditambahkan",
      description: `Menambahkan kandidat no. ${created.candidateNumber}: ${created.name}`,
      ipAddress: extractClientIp(request),
    });

    revalidateElectionCaches(election.id);

    const dto: CandidateDTO = {
      id: created.id,
      electionId: created.electionId,
      candidateNumber: created.candidateNumber,
      name: created.name,
      classOrUnit: created.classOrUnit,
      motto: created.motto,
      vision: created.vision,
      missions: (created.missions as string[]) ?? [],
      programs: (created.programs as string[]) ?? [],
      supporters: (created.supporters as string[]) ?? [],
      photoUrl: created.photoUrl,
      themeColor: (created.themeColor as CandidateTheme) ?? "red",
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };

    return formatSuccessResponse(dto, undefined, 201);
  } catch (error) {
    console.error("Candidates POST route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menambahkan kandidat.",
      500
    );
  }
}
