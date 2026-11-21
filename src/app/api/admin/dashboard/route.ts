import { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import { formatErrorResponse, formatSuccessResponse } from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { getCachedDashboardStats } from "@/lib/admin/cached-aggregations";

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

    const stats = await getCachedDashboardStats(election.id);
    if (!stats) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Data statistik pemilihan tidak ditemukan.",
        404
      );
    }

    return formatSuccessResponse(stats, undefined, 200, {
      "Cache-Control": "private, max-age=3, stale-while-revalidate=2",
    });
  } catch (error) {
    console.error("Dashboard route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan saat memuat data dashboard.",
      500
    );
  }
}
