import { NextRequest } from "next/server";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { auditLogs, db } from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { auditLogQuerySchema } from "@/lib/validations/logs";
import type {
  ActorType,
  AuditLogDTO,
  AuditLogListResponseDTO,
  AuditLogSummaryDTO,
  PaginationMeta,
} from "@/types/votera";

function parseFilterDate(value: string, boundary: "start" | "end"): Date | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const suffix =
      boundary === "start" ? "T00:00:00.000+07:00" : "T23:59:59.999+07:00";
    const parsed = new Date(`${trimmed}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
    const queryObj = {
      electionId: searchParams.get("electionId") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      actorType: searchParams.get("actorType") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    };

    const parsed = auditLogQuerySchema.safeParse(queryObj);
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

    const conditions = [eq(auditLogs.electionId, election.id)];

    if (parsed.data.search) {
      const term = `%${parsed.data.search}%`;
      conditions.push(
        or(
          ilike(auditLogs.actorName, term),
          ilike(auditLogs.actorIdentity, term),
          ilike(auditLogs.actionTitle, term),
          ilike(auditLogs.description, term)
        )!
      );
    }

    if (parsed.data.actorType && parsed.data.actorType !== "all") {
      conditions.push(eq(auditLogs.actorType, parsed.data.actorType));
    }

    if (parsed.data.action && parsed.data.action !== "all") {
      conditions.push(eq(auditLogs.action, parsed.data.action));
    }

    if (parsed.data.dateFrom) {
      const fromDate = parseFilterDate(parsed.data.dateFrom, "start");
      if (!fromDate) {
        return formatErrorResponse(
          "VALIDATION_ERROR",
          "Format tanggal mulai (dateFrom) tidak valid.",
          400
        );
      }
      conditions.push(gte(auditLogs.createdAt, fromDate));
    }

    if (parsed.data.dateTo) {
      const toDate = parseFilterDate(parsed.data.dateTo, "end");
      if (!toDate) {
        return formatErrorResponse(
          "VALIDATION_ERROR",
          "Format tanggal selesai (dateTo) tidak valid.",
          400
        );
      }
      conditions.push(lte(auditLogs.createdAt, toDate));
    }

    const whereClause = and(...conditions);

    // Count matching
    const [countRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(auditLogs)
      .where(whereClause);

    const total = countRow?.count ?? 0;
    const page = parsed.data.page;
    const limit = parsed.data.limit;
    const offset = (page - 1) * limit;

    const rows = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const logs: AuditLogDTO[] = rows.map((log) => ({
      id: log.id,
      electionId: log.electionId,
      actorType: log.actorType as ActorType,
      actorId: log.actorId,
      actorName: log.actorName,
      actorIdentity: log.actorIdentity,
      action: log.action,
      actionTitle: log.actionTitle,
      description: log.description,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    }));

    // Summary counts for this election
    const [summaryRow] = await db
      .select({
        totalLogs: sql<number>`cast(count(*) as int)`,
        adminActivities: sql<number>`cast(count(*) filter (where ${auditLogs.actorType} = 'admin') as int)`,
        voterLoginSuccess: sql<number>`cast(count(*) filter (where ${auditLogs.action} = 'voter_login' or ${auditLogs.action} = 'login') as int)`,
        voterLoginFailed: sql<number>`cast(count(*) filter (where ${auditLogs.action} = 'voter_login_failed') as int)`,
      })
      .from(auditLogs)
      .where(eq(auditLogs.electionId, election.id));

    const summary: AuditLogSummaryDTO = {
      totalLogs: summaryRow?.totalLogs ?? 0,
      adminActivities: summaryRow?.adminActivities ?? 0,
      voterLoginSuccess: summaryRow?.voterLoginSuccess ?? 0,
      voterLoginFailed: summaryRow?.voterLoginFailed ?? 0,
    };

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };

    const responseData: AuditLogListResponseDTO = {
      logs,
      summary,
      meta,
    };

    return formatSuccessResponse(responseData, meta);
  } catch (error) {
    console.error("Logs GET route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memuat log aktivitas.",
      500
    );
  }
}
