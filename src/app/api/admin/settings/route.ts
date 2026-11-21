import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, electionSettings, elections } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { revalidateElectionCaches } from "@/lib/admin/cached-aggregations";
import { updateSettingsSchema } from "@/lib/validations/settings";
import { insertAuditLog } from "@/lib/audit";
import type { ElectionSettingsDTO, ElectionStatus } from "@/types/votera";

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

    const [settings] = await db
      .select()
      .from(electionSettings)
      .where(eq(electionSettings.electionId, election.id))
      .limit(1);

    const electionData = {
      id: election.id,
      slug: election.slug,
      shortName: election.shortName,
      title: election.title,
      organizationName: election.organizationName,
      description: election.description,
      status: election.status as ElectionStatus,
      startAt: election.startAt ? election.startAt.toISOString() : null,
      endAt: election.endAt ? election.endAt.toISOString() : null,
      isActive: election.isActive,
    };

    const settingsData: ElectionSettingsDTO = {
      idLabel: settings?.idLabel ?? "NIS",
      groupLabel: settings?.groupLabel ?? "Rombel",
      gradeLabel: settings?.gradeLabel ?? "Tingkat",
      majorLabel: settings?.majorLabel ?? "Jurusan",
      isResultPublic: settings?.isResultPublic ?? false,
      logoUrl: settings?.logoUrl ?? null,
      heroBannerUrl: settings?.heroBannerUrl ?? null,
    };

    return formatSuccessResponse({
      election: electionData,
      settings: settingsData,
    });
  } catch (error) {
    console.error("Settings GET route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memuat pengaturan pemilihan.",
      500
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const parsed = updateSettingsSchema.safeParse(rawBody);
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

    // Update election fields
    const electionUpdates: Partial<typeof elections.$inferInsert> = {};
    if (parsed.data.shortName !== undefined) {
      electionUpdates.shortName = parsed.data.shortName;
    }
    if (parsed.data.title !== undefined) {
      electionUpdates.title = parsed.data.title;
    }
    if (parsed.data.organizationName !== undefined) {
      electionUpdates.organizationName = parsed.data.organizationName;
    }
    if (parsed.data.description !== undefined) {
      electionUpdates.description = parsed.data.description;
    }
    if (parsed.data.status !== undefined) {
      electionUpdates.status = parsed.data.status;
    }
    if (parsed.data.startAt !== undefined) {
      electionUpdates.startAt = parsed.data.startAt
        ? new Date(parsed.data.startAt)
        : null;
    }
    if (parsed.data.endAt !== undefined) {
      electionUpdates.endAt = parsed.data.endAt
        ? new Date(parsed.data.endAt)
        : null;
    }
    electionUpdates.updatedAt = new Date();

    const [updatedElection] = await db
      .update(elections)
      .set(electionUpdates)
      .where(eq(elections.id, election.id))
      .returning();

    // Update or insert electionSettings
    const settingsUpdates: Partial<typeof electionSettings.$inferInsert> = {
      electionId: election.id,
      updatedAt: new Date(),
    };
    if (parsed.data.idLabel !== undefined) {
      settingsUpdates.idLabel = parsed.data.idLabel;
    }
    if (parsed.data.groupLabel !== undefined) {
      settingsUpdates.groupLabel = parsed.data.groupLabel;
    }
    if (parsed.data.gradeLabel !== undefined) {
      settingsUpdates.gradeLabel = parsed.data.gradeLabel;
    }
    if (parsed.data.majorLabel !== undefined) {
      settingsUpdates.majorLabel = parsed.data.majorLabel;
    }
    if (parsed.data.isResultPublic !== undefined) {
      settingsUpdates.isResultPublic = parsed.data.isResultPublic;
    }
    if (parsed.data.logoUrl !== undefined) {
      settingsUpdates.logoUrl = parsed.data.logoUrl;
    }
    if (parsed.data.heroBannerUrl !== undefined) {
      settingsUpdates.heroBannerUrl = parsed.data.heroBannerUrl;
    }

    const [existingSettings] = await db
      .select({ id: electionSettings.id })
      .from(electionSettings)
      .where(eq(electionSettings.electionId, election.id))
      .limit(1);

    let finalSettings: typeof electionSettings.$inferSelect;
    if (existingSettings) {
      const [updated] = await db
        .update(electionSettings)
        .set(settingsUpdates)
        .where(eq(electionSettings.electionId, election.id))
        .returning();
      finalSettings = updated;
    } else {
      const [inserted] = await db
        .insert(electionSettings)
        .values({
          electionId: election.id,
          idLabel: parsed.data.idLabel ?? "NIS",
          groupLabel: parsed.data.groupLabel ?? "Rombel",
          gradeLabel: parsed.data.gradeLabel ?? "Tingkat",
          majorLabel: parsed.data.majorLabel ?? "Jurusan",
          isResultPublic: parsed.data.isResultPublic ?? false,
          logoUrl: parsed.data.logoUrl ?? null,
          heroBannerUrl: parsed.data.heroBannerUrl ?? null,
        })
        .returning();
      finalSettings = inserted;
    }

    const isScheduleChanged =
      (parsed.data.startAt !== undefined &&
        (election.startAt ? election.startAt.toISOString() : null) !==
          (parsed.data.startAt
            ? new Date(parsed.data.startAt).toISOString()
            : null)) ||
      (parsed.data.endAt !== undefined &&
        (election.endAt ? election.endAt.toISOString() : null) !==
          (parsed.data.endAt
            ? new Date(parsed.data.endAt).toISOString()
            : null));

    if (election.status === "open" && isScheduleChanged) {
      await insertAuditLog({
        electionId: election.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: session.user.username
          ? `@${session.user.username}`
          : session.user.email,
        action: "schedule_adjusted",
        actionTitle: "Jadwal pemilihan disesuaikan",
        description: `Menyesuaikan jam operasional pemilihan saat berstatus Open. Mulai: ${updatedElection.startAt ? updatedElection.startAt.toISOString() : "-"}, Selesai: ${updatedElection.endAt ? updatedElection.endAt.toISOString() : "-"}`,
        ipAddress: extractClientIp(request),
      });
    }

    await insertAuditLog({
      electionId: election.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.username
        ? `@${session.user.username}`
        : session.user.email,
      action: "election_settings_updated",
      actionTitle: "Pengaturan diperbarui",
      description: `Memperbarui pengaturan pemilihan ${updatedElection.shortName}`,
      ipAddress: extractClientIp(request),
    });

    revalidateElectionCaches(election.id);

    return formatSuccessResponse({
      election: {
        id: updatedElection.id,
        slug: updatedElection.slug,
        shortName: updatedElection.shortName,
        title: updatedElection.title,
        organizationName: updatedElection.organizationName,
        description: updatedElection.description,
        status: updatedElection.status as ElectionStatus,
        startAt: updatedElection.startAt
          ? updatedElection.startAt.toISOString()
          : null,
        endAt: updatedElection.endAt
          ? updatedElection.endAt.toISOString()
          : null,
        isActive: updatedElection.isActive,
      },
      settings: {
        idLabel: finalSettings.idLabel,
        groupLabel: finalSettings.groupLabel,
        gradeLabel: finalSettings.gradeLabel,
        majorLabel: finalSettings.majorLabel,
        isResultPublic: finalSettings.isResultPublic,
        logoUrl: finalSettings.logoUrl,
        heroBannerUrl: finalSettings.heroBannerUrl,
      },
    });
  } catch (error) {
    console.error("Settings PUT route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memperbarui pengaturan pemilihan.",
      500
    );
  }
}
