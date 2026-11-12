"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { ApiResponse, DashboardStatsDTO } from "@/types/votera";

export interface UseDashboardStatsOptions {
  autoRefresh?: boolean;
  intervalMs?: 8_000 | 30_000;
  enabled?: boolean;
}

export function useDashboardStats(
  electionId: string,
  options: boolean | UseDashboardStatsOptions = true
) {
  const resolvedOptions: UseDashboardStatsOptions =
    typeof options === "boolean" ? { autoRefresh: options } : options;

  const {
    autoRefresh = true,
    intervalMs = 8_000,
    enabled = Boolean(electionId),
  } = resolvedOptions;

  return useQuery<DashboardStatsDTO, Error>({
    queryKey: queryKeys.election.dashboard(electionId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (electionId && electionId !== "active") {
        params.set("electionId", electionId);
      }
      const query = params.toString();
      const res = await fetch(`/api/admin/dashboard${query ? `?${query}` : ""}`);
      const json = (await res.json().catch(() => null)) as ApiResponse<DashboardStatsDTO> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memuat statistik dashboard";
        throw new Error(message);
      }

      return json.data;
    },
    enabled,
    staleTime: 4_000,
    refetchInterval: autoRefresh ? intervalMs : false,
    refetchIntervalInBackground: false,
    retry: 2,
  });
}
