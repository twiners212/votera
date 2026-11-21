import { NextRequest } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { candidates, db, elections, votes } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { revalidateElectionCaches } from "@/lib/admin/cached-aggregations";
import { candidateUpdateSchema } from "@/lib/validations/candidate";
import { uuidParamSchema } from "@/lib/validations/admin-common";
import { insertAuditLog } from "@/lib/audit";
import { isElectionOngoing } from "@/lib/admin/election-state";
import type { CandidateDTO, CandidateTheme } from "@/types/votera";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { id } = await context.params;
    const paramParsed = uuidParamSchema.safeParse({ id });
    if (!paramParsed.success) {
      return formatZodErrorResponse(paramParsed.error);
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse("VALIDATION_ERROR", "Payload JSON tidak valid.", 400);
    }

    const parsed = candidateUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    const [existing] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, id))
      .limit(1);

    if (!existing) {
      return formatErrorResponse("NOT_FOUND", "Data kandidat tidak ditemukan.", 404);
    }

    const [voteCountRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(votes)
      .where(eq(votes.candidateId, existing.id));
    const voteCount = Number(voteCountRow?.count) || 0;

    if (voteCount > 0) {
      if (
        parsed.data.candidateNumber !== undefined &&
        parsed.data.candidateNumber !== existing.candidateNumber
      ) {
        return formatErrorResponse(
          "CONFLICT",
          "Nomor urut tidak dapat diubah karena kandidat sudah memiliki perolehan suara pemilih.",
          409
        );
      }

      if (parsed.data.isActive === false && existing.isActive === true) {
        return formatErrorResponse(
          "CONFLICT",
          "Kandidat tidak dapat dinonaktifkan karena sudah memiliki perolehan suara pemilih.",
          409
        );
      }
    }

    if (
      parsed.data.candidateNumber !== undefined &&
      parsed.data.candidateNumber !== existing.candidateNumber
    ) {
      const [duplicate] = await db
        .select({ id: candidates.id })
        .from(candidates)
        .where(
          and(
            eq(candidates.electionId, existing.electionId),
            eq(candidates.candidateNumber, parsed.data.candidateNumber),
            ne(candidates.id, id)
          )
        )
        .limit(1);

      if (duplicate) {
        return formatErrorResponse(
          "CONFLICT",
          `Nomor urut ${parsed.data.candidateNumber} sudah digunakan oleh kandidat lain.`,
          409
        );
      }
    }

    const [updated] = await db
      .update(candidates)
      .set({
        ...(parsed.data.candidateNumber !== undefined
          ? { candidateNumber: parsed.data.candidateNumber }
          : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.classOrUnit !== undefined
          ? { classOrUnit: parsed.data.classOrUnit }
          : {}),
        ...(parsed.data.motto !== undefined ? { motto: parsed.data.motto } : {}),
        ...(parsed.data.vision !== undefined ? { vision: parsed.data.vision } : {}),
        ...(parsed.data.missions !== undefined
          ? { missions: parsed.data.missions }
          : {}),
        ...(parsed.data.programs !== undefined
          ? { programs: parsed.data.programs }
          : {}),
        ...(parsed.data.supporters !== undefined
          ? { supporters: parsed.data.supporters }
          : {}),
        ...(parsed.data.photoUrl !== undefined
          ? { photoUrl: parsed.data.photoUrl }
          : {}),
        ...(parsed.data.themeColor !== undefined
          ? { themeColor: parsed.data.themeColor }
          : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, id))
      .returning();

    await insertAuditLog({
      electionId: updated.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "candidate_updated",
      actionTitle: "Kandidat diperbarui",
      description:
        voteCount > 0
          ? `Memperbarui profil kandidat no. ${updated.candidateNumber}: ${updated.name} (koreksi profil saat sudah ada ${voteCount} suara)`
          : `Memperbarui kandidat no. ${updated.candidateNumber}: ${updated.name}`,
      ipAddress: extractClientIp(request),
    });

    revalidateElectionCaches(updated.electionId);

    const dto: CandidateDTO = {
      id: updated.id,
      electionId: updated.electionId,
      candidateNumber: updated.candidateNumber,
      name: updated.name,
      classOrUnit: updated.classOrUnit,
      motto: updated.motto,
      vision: updated.vision,
      missions: (updated.missions as string[]) ?? [],
      programs: (updated.programs as string[]) ?? [],
      supporters: (updated.supporters as string[]) ?? [],
      photoUrl: updated.photoUrl,
      themeColor: (updated.themeColor as CandidateTheme) ?? "red",
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    return formatSuccessResponse(dto);
  } catch (error) {
    console.error("Candidate PATCH route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memperbarui kandidat.",
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { id } = await context.params;
    const paramParsed = uuidParamSchema.safeParse({ id });
    if (!paramParsed.success) {
      return formatZodErrorResponse(paramParsed.error);
    }

    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, id))
      .limit(1);

    if (!candidate) {
      return formatErrorResponse("NOT_FOUND", "Data kandidat tidak ditemukan.", 404);
    }

    const [election] = await db
      .select({
        status: elections.status,
        startAt: elections.startAt,
        endAt: elections.endAt,
      })
      .from(elections)
      .where(eq(elections.id, candidate.electionId))
      .limit(1);

    if (isElectionOngoing(election)) {
      return formatErrorResponse(
        "CONFLICT",
        "Kandidat tidak dapat dihapus saat pemilihan sedang berlangsung.",
        409
      );
    }

    const [voteCountRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(votes)
      .where(eq(votes.candidateId, candidate.id));

    if ((voteCountRow?.count ?? 0) > 0) {
      return formatErrorResponse(
        "CONFLICT",
        "Kandidat tidak dapat dihapus karena sudah memiliki perolehan suara.",
        409
      );
    }

    await db.delete(candidates).where(eq(candidates.id, id));

    await insertAuditLog({
      electionId: candidate.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "candidate_deleted",
      actionTitle: "Kandidat dihapus",
      description: `Menghapus kandidat no. ${candidate.candidateNumber}: ${candidate.name}`,
      ipAddress: extractClientIp(request),
    });

    revalidateElectionCaches(candidate.electionId);

    return formatSuccessResponse({ id: candidate.id });
  } catch (error) {
    console.error("Candidate DELETE route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menghapus kandidat.",
      500
    );
  }
}
