import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { elections, auditLogs } from "@/db/schema";
import { eq, and, or, ilike, desc, count, sql, gte, lte } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const actorType = searchParams.get("actorType")?.trim() || "all";
    const action = searchParams.get("action")?.trim() || "all";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const offset = (page - 1) * limit;

    // 1. Ambil pemilihan aktif
    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    if (!activeElection) {
      return NextResponse.json(
        {
          success: false,
          error: "NO_ACTIVE_ELECTION",
          message: "Tidak ada pemilihan aktif.",
        },
        { status: 404 }
      );
    }

    // 2. Susun filter query
    const conditions = [eq(auditLogs.electionId, activeElection.id)];

    if (actorType && actorType !== "all" && actorType !== "Semua") {
      const normalizedActor = actorType.toLowerCase();
      if (
        normalizedActor === "admin" ||
        normalizedActor === "panitia"
      ) {
        conditions.push(eq(auditLogs.actorType, "admin"));
      } else if (
        normalizedActor === "voter" ||
        normalizedActor === "pemilih"
      ) {
        conditions.push(eq(auditLogs.actorType, "voter"));
      } else if (
        normalizedActor === "system" ||
        normalizedActor === "sistem"
      ) {
        conditions.push(eq(auditLogs.actorType, "system"));
      }
    }

    if (action && action !== "all" && action !== "Semua") {
      conditions.push(eq(auditLogs.action, action));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(auditLogs.description, searchPattern),
          ilike(auditLogs.actorName, searchPattern),
          ilike(auditLogs.actorIdentity, searchPattern),
          ilike(auditLogs.actionTitle, searchPattern),
          ilike(auditLogs.ipAddress, searchPattern)
        )!
      );
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      conditions.push(gte(auditLogs.createdAt, fromDate));
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, toDate));
    }

    const whereClause = and(...conditions);

    // 3. Ambil data terfilter dengan paginasi
    const logs = await db
      .select({
        id: auditLogs.id,
        actorType: auditLogs.actorType,
        actorId: auditLogs.actorId,
        actorName: auditLogs.actorName,
        actorIdentity: auditLogs.actorIdentity,
        action: auditLogs.action,
        actionTitle: auditLogs.actionTitle,
        description: auditLogs.description,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // 4. Hitung total catatan yang sesuai filter
    const [totalFilteredStats] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);
    const totalFiltered = Number(totalFilteredStats?.count || 0);

    // 5. Hitung metrik KPI global audit log untuk pemilihan ini
    const [kpiStats] = await db
      .select({
        totalLogs: count(),
        adminLogs: count(
          sql`CASE WHEN ${auditLogs.actorType} = 'admin' THEN 1 END`
        ),
        voterSuccessLogs: count(
          sql`CASE WHEN ${auditLogs.action} IN ('voter_login', 'vote_cast') THEN 1 END`
        ),
        failedLoginLogs: count(
          sql`CASE WHEN ${auditLogs.action} IN ('login_failed', 'voter_login_failed') THEN 1 END`
        ),
      })
      .from(auditLogs)
      .where(eq(auditLogs.electionId, activeElection.id));

    const totalLogs = Number(kpiStats?.totalLogs || 0);
    const adminLogs = Number(kpiStats?.adminLogs || 0);
    const voterSuccessLogs = Number(kpiStats?.voterSuccessLogs || 0);
    const failedLoginLogs = Number(kpiStats?.failedLoginLogs || 0);

    const adminPercent =
      totalLogs > 0 ? ((adminLogs / totalLogs) * 100).toFixed(1) : "0";

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total: totalFiltered,
          totalPages: Math.ceil(totalFiltered / limit) || 1,
        },
        kpis: {
          totalLogs,
          adminLogs,
          adminPercent: `${adminPercent}%`,
          voterSuccessLogs,
          failedLoginLogs,
        },
      },
    });
  } catch (error) {
    console.error("Gagal mengambil log aktivitas:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: "Terjadi kesalahan saat memuat log aktivitas.",
      },
      { status: 500 }
    );
  }
}
