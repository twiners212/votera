import { NextRequest } from "next/server";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db, gradeLevels, majors, voterGroups, voters } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { revalidateElectionCaches } from "@/lib/admin/cached-aggregations";
import {
  masterCreateSchema,
  masterDeleteSchema,
  masterUpdateSchema,
} from "@/lib/validations/master";
import { insertAuditLog } from "@/lib/audit";
import type { MasterDataDTO } from "@/types/votera";

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

    // Grade levels with groupCount
    const gradeRows = await db
      .select({
        id: gradeLevels.id,
        electionId: gradeLevels.electionId,
        name: gradeLevels.name,
        sortOrder: gradeLevels.sortOrder,
        groupCount: sql<number>`cast(count(${voterGroups.id}) as int)`,
      })
      .from(gradeLevels)
      .leftJoin(voterGroups, eq(gradeLevels.id, voterGroups.gradeLevelId))
      .where(eq(gradeLevels.electionId, election.id))
      .groupBy(gradeLevels.id, gradeLevels.name, gradeLevels.sortOrder)
      .orderBy(asc(gradeLevels.sortOrder), asc(gradeLevels.name));

    // Majors with groupCount
    const majorRows = await db
      .select({
        id: majors.id,
        electionId: majors.electionId,
        name: majors.name,
        code: majors.code,
        sortOrder: majors.sortOrder,
        groupCount: sql<number>`cast(count(${voterGroups.id}) as int)`,
      })
      .from(majors)
      .leftJoin(voterGroups, eq(majors.id, voterGroups.majorId))
      .where(eq(majors.electionId, election.id))
      .groupBy(majors.id, majors.name, majors.code, majors.sortOrder)
      .orderBy(asc(majors.sortOrder), asc(majors.name));

    // Voter groups with grade/major names and voterCount
    const groupRows = await db
      .select({
        id: voterGroups.id,
        electionId: voterGroups.electionId,
        gradeLevelId: voterGroups.gradeLevelId,
        gradeName: gradeLevels.name,
        majorId: voterGroups.majorId,
        majorName: majors.name,
        name: voterGroups.name,
        sortOrder: voterGroups.sortOrder,
        voterCount: sql<number>`cast(count(${voters.id}) as int)`,
      })
      .from(voterGroups)
      .leftJoin(gradeLevels, eq(voterGroups.gradeLevelId, gradeLevels.id))
      .leftJoin(majors, eq(voterGroups.majorId, majors.id))
      .leftJoin(voters, eq(voterGroups.id, voters.groupId))
      .where(eq(voterGroups.electionId, election.id))
      .groupBy(
        voterGroups.id,
        voterGroups.name,
        voterGroups.gradeLevelId,
        gradeLevels.name,
        voterGroups.majorId,
        majors.name,
        voterGroups.sortOrder
      )
      .orderBy(asc(voterGroups.sortOrder), asc(voterGroups.name));

    const masterData: MasterDataDTO = {
      gradeLevels: gradeRows.map((g) => ({
        id: g.id,
        electionId: g.electionId,
        name: g.name,
        sortOrder: g.sortOrder,
        groupCount: g.groupCount,
      })),
      majors: majorRows.map((m) => ({
        id: m.id,
        electionId: m.electionId,
        name: m.name,
        code: m.code,
        sortOrder: m.sortOrder,
        groupCount: m.groupCount,
      })),
      voterGroups: groupRows.map((v) => ({
        id: v.id,
        electionId: v.electionId,
        gradeLevelId: v.gradeLevelId,
        gradeName: v.gradeName ?? null,
        majorId: v.majorId,
        majorName: v.majorName ?? null,
        name: v.name,
        sortOrder: v.sortOrder,
        voterCount: v.voterCount,
      })),
    };

    return formatSuccessResponse(masterData);
  } catch (error) {
    console.error("Master GET route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memuat data master.",
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
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload JSON tidak valid.",
        400
      );
    }

    const parsed = masterCreateSchema.safeParse(rawBody);
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

    let createdResult: unknown;

    if (parsed.data.entity === "grade") {
      const [duplicate] = await db
        .select({ id: gradeLevels.id })
        .from(gradeLevels)
        .where(
          and(
            eq(gradeLevels.electionId, election.id),
            eq(gradeLevels.name, parsed.data.name)
          )
        )
        .limit(1);

      if (duplicate) {
        return formatErrorResponse(
          "CONFLICT",
          `Tingkat "${parsed.data.name}" sudah ada dalam pemilihan ini.`,
          409
        );
      }

      const [created] = await db
        .insert(gradeLevels)
        .values({
          electionId: election.id,
          name: parsed.data.name,
          sortOrder: parsed.data.sortOrder,
        })
        .returning();

      createdResult = created;
      await insertAuditLog({
        electionId: election.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_created",
        actionTitle: "Tingkat kelas ditambahkan",
        description: `Menambahkan tingkat kelas: ${created.name}`,
        ipAddress: extractClientIp(request),
      });
    } else if (parsed.data.entity === "major") {
      const [duplicate] = await db
        .select({ id: majors.id })
        .from(majors)
        .where(
          and(
            eq(majors.electionId, election.id),
            eq(majors.name, parsed.data.name)
          )
        )
        .limit(1);

      if (duplicate) {
        return formatErrorResponse(
          "CONFLICT",
          `Jurusan "${parsed.data.name}" sudah ada dalam pemilihan ini.`,
          409
        );
      }

      const [created] = await db
        .insert(majors)
        .values({
          electionId: election.id,
          name: parsed.data.name,
          code: parsed.data.code ?? null,
          sortOrder: parsed.data.sortOrder,
        })
        .returning();

      createdResult = created;
      await insertAuditLog({
        electionId: election.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_created",
        actionTitle: "Jurusan ditambahkan",
        description: `Menambahkan jurusan: ${created.name}`,
        ipAddress: extractClientIp(request),
      });
    } else {
      // group
      const [duplicate] = await db
        .select({ id: voterGroups.id })
        .from(voterGroups)
        .where(
          and(
            eq(voterGroups.electionId, election.id),
            eq(voterGroups.name, parsed.data.name)
          )
        )
        .limit(1);

      if (duplicate) {
        return formatErrorResponse(
          "CONFLICT",
          `Rombel "${parsed.data.name}" sudah ada dalam pemilihan ini.`,
          409
        );
      }

      const [created] = await db
        .insert(voterGroups)
        .values({
          electionId: election.id,
          name: parsed.data.name,
          gradeLevelId: parsed.data.gradeLevelId ?? null,
          majorId: parsed.data.majorId ?? null,
          sortOrder: parsed.data.sortOrder,
        })
        .returning();

      createdResult = created;
      await insertAuditLog({
        electionId: election.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_created",
        actionTitle: "Rombel ditambahkan",
        description: `Menambahkan rombel: ${created.name}`,
        ipAddress: extractClientIp(request),
      });
    }

    revalidateElectionCaches(election.id);

    return formatSuccessResponse(createdResult, undefined, 201);
  } catch (error) {
    console.error("Master POST route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menambahkan data master.",
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload JSON tidak valid.",
        400
      );
    }

    const parsed = masterUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    let updatedResult: unknown;
    let targetElectionId: string | null = null;

    if (parsed.data.entity === "grade") {
      const [existing] = await db
        .select()
        .from(gradeLevels)
        .where(eq(gradeLevels.id, parsed.data.id))
        .limit(1);

      if (!existing) {
        return formatErrorResponse(
          "NOT_FOUND",
          "Tingkat kelas tidak ditemukan.",
          404
        );
      }

      targetElectionId = existing.electionId;

      if (parsed.data.name && parsed.data.name !== existing.name) {
        const [duplicate] = await db
          .select({ id: gradeLevels.id })
          .from(gradeLevels)
          .where(
            and(
              eq(gradeLevels.electionId, existing.electionId),
              eq(gradeLevels.name, parsed.data.name),
              ne(gradeLevels.id, existing.id)
            )
          )
          .limit(1);

        if (duplicate) {
          return formatErrorResponse(
            "CONFLICT",
            `Nama tingkat "${parsed.data.name}" sudah digunakan.`,
            409
          );
        }
      }

      const [updated] = await db
        .update(gradeLevels)
        .set({
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.sortOrder !== undefined
            ? { sortOrder: parsed.data.sortOrder }
            : {}),
        })
        .where(eq(gradeLevels.id, parsed.data.id))
        .returning();

      updatedResult = updated;
      await insertAuditLog({
        electionId: existing.electionId,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_updated",
        actionTitle: "Tingkat kelas diperbarui",
        description: `Memperbarui tingkat: ${updated.name}`,
        ipAddress: extractClientIp(request),
      });
    } else if (parsed.data.entity === "major") {
      const [existing] = await db
        .select()
        .from(majors)
        .where(eq(majors.id, parsed.data.id))
        .limit(1);

      if (!existing) {
        return formatErrorResponse("NOT_FOUND", "Jurusan tidak ditemukan.", 404);
      }

      targetElectionId = existing.electionId;

      if (parsed.data.name && parsed.data.name !== existing.name) {
        const [duplicate] = await db
          .select({ id: majors.id })
          .from(majors)
          .where(
            and(
              eq(majors.electionId, existing.electionId),
              eq(majors.name, parsed.data.name),
              ne(majors.id, existing.id)
            )
          )
          .limit(1);

        if (duplicate) {
          return formatErrorResponse(
            "CONFLICT",
            `Nama jurusan "${parsed.data.name}" sudah digunakan.`,
            409
          );
        }
      }

      const [updated] = await db
        .update(majors)
        .set({
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.code !== undefined
            ? { code: parsed.data.code ?? null }
            : {}),
          ...(parsed.data.sortOrder !== undefined
            ? { sortOrder: parsed.data.sortOrder }
            : {}),
        })
        .where(eq(majors.id, parsed.data.id))
        .returning();

      updatedResult = updated;
      await insertAuditLog({
        electionId: existing.electionId,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_updated",
        actionTitle: "Jurusan diperbarui",
        description: `Memperbarui jurusan: ${updated.name}`,
        ipAddress: extractClientIp(request),
      });
    } else {
      // group
      const [existing] = await db
        .select()
        .from(voterGroups)
        .where(eq(voterGroups.id, parsed.data.id))
        .limit(1);

      if (!existing) {
        return formatErrorResponse("NOT_FOUND", "Rombel tidak ditemukan.", 404);
      }

      targetElectionId = existing.electionId;

      if (parsed.data.name && parsed.data.name !== existing.name) {
        const [duplicate] = await db
          .select({ id: voterGroups.id })
          .from(voterGroups)
          .where(
            and(
              eq(voterGroups.electionId, existing.electionId),
              eq(voterGroups.name, parsed.data.name),
              ne(voterGroups.id, existing.id)
            )
          )
          .limit(1);

        if (duplicate) {
          return formatErrorResponse(
            "CONFLICT",
            `Nama rombel "${parsed.data.name}" sudah digunakan.`,
            409
          );
        }
      }

      const [updated] = await db
        .update(voterGroups)
        .set({
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.gradeLevelId !== undefined
            ? { gradeLevelId: parsed.data.gradeLevelId ?? null }
            : {}),
          ...(parsed.data.majorId !== undefined
            ? { majorId: parsed.data.majorId ?? null }
            : {}),
          ...(parsed.data.sortOrder !== undefined
            ? { sortOrder: parsed.data.sortOrder }
            : {}),
        })
        .where(eq(voterGroups.id, parsed.data.id))
        .returning();

      updatedResult = updated;
      await insertAuditLog({
        electionId: existing.electionId,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_updated",
        actionTitle: "Rombel diperbarui",
        description: `Memperbarui rombel: ${updated.name}`,
        ipAddress: extractClientIp(request),
      });
    }

    if (targetElectionId) {
      revalidateElectionCaches(targetElectionId);
    }

    return formatSuccessResponse(updatedResult);
  } catch (error) {
    console.error("Master PATCH route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memperbarui data master.",
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const { searchParams } = new URL(request.url);
    let payload: Record<string, unknown> = {
      entity: searchParams.get("entity"),
      id: searchParams.get("id"),
      electionId: searchParams.get("electionId") ?? undefined,
    };

    if (!payload.entity || !payload.id) {
      const body = await request.json().catch(() => null);
      if (body && typeof body === "object") {
        payload = body as Record<string, unknown>;
      }
    }

    const parsed = masterDeleteSchema.safeParse(payload);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    let targetElectionId: string | null = null;

    if (parsed.data.entity === "grade") {
      const [grade] = await db
        .select()
        .from(gradeLevels)
        .where(eq(gradeLevels.id, parsed.data.id))
        .limit(1);

      if (!grade) {
        return formatErrorResponse(
          "NOT_FOUND",
          "Tingkat kelas tidak ditemukan.",
          404
        );
      }

      targetElectionId = grade.electionId;

      // Check if referenced by voter_groups
      const [groupRef] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(voterGroups)
        .where(eq(voterGroups.gradeLevelId, parsed.data.id));

      if ((groupRef?.count ?? 0) > 0) {
        return formatErrorResponse(
          "CONFLICT",
          "Tingkat masih digunakan oleh rombel. Hapus atau pindahkan rombel terkait terlebih dahulu.",
          409
        );
      }

      await db.delete(gradeLevels).where(eq(gradeLevels.id, parsed.data.id));

      await insertAuditLog({
        electionId: grade.electionId,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_deleted",
        actionTitle: "Tingkat kelas dihapus",
        description: `Menghapus tingkat kelas: ${grade.name}`,
        ipAddress: extractClientIp(request),
      });
    } else if (parsed.data.entity === "major") {
      const [major] = await db
        .select()
        .from(majors)
        .where(eq(majors.id, parsed.data.id))
        .limit(1);

      if (!major) {
        return formatErrorResponse("NOT_FOUND", "Jurusan tidak ditemukan.", 404);
      }

      targetElectionId = major.electionId;

      // Check if referenced by voter_groups
      const [groupRef] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(voterGroups)
        .where(eq(voterGroups.majorId, parsed.data.id));

      if ((groupRef?.count ?? 0) > 0) {
        return formatErrorResponse(
          "CONFLICT",
          "Jurusan masih digunakan oleh rombel. Hapus atau pindahkan rombel terkait terlebih dahulu.",
          409
        );
      }

      await db.delete(majors).where(eq(majors.id, parsed.data.id));

      await insertAuditLog({
        electionId: major.electionId,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_deleted",
        actionTitle: "Jurusan dihapus",
        description: `Menghapus jurusan: ${major.name}`,
        ipAddress: extractClientIp(request),
      });
    } else {
      // group
      const [group] = await db
        .select()
        .from(voterGroups)
        .where(eq(voterGroups.id, parsed.data.id))
        .limit(1);

      if (!group) {
        return formatErrorResponse("NOT_FOUND", "Rombel tidak ditemukan.", 404);
      }

      targetElectionId = group.electionId;

      // Check if referenced by voters
      const [voterRef] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(voters)
        .where(eq(voters.groupId, parsed.data.id));

      if ((voterRef?.count ?? 0) > 0) {
        return formatErrorResponse(
          "CONFLICT",
          "Rombel masih memiliki data pemilih terdaftar. Hapus atau pindahkan data pemilih terlebih dahulu.",
          409
        );
      }

      await db.delete(voterGroups).where(eq(voterGroups.id, parsed.data.id));

      await insertAuditLog({
        electionId: group.electionId,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "master_deleted",
        actionTitle: "Rombel dihapus",
        description: `Menghapus rombel: ${group.name}`,
        ipAddress: extractClientIp(request),
      });
    }

    if (targetElectionId) {
      revalidateElectionCaches(targetElectionId);
    }

    return formatSuccessResponse({ id: parsed.data.id });
  } catch (error) {
    console.error("Master DELETE route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat menghapus data master.",
      500
    );
  }
}
