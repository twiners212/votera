"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { ApiResponse, ElectionResultsDTO } from "@/types/votera";

export interface UseElectionResultsOptions {
  autoRefresh?: boolean;
  intervalMs?: 8_000 | 30_000;
  enabled?: boolean;
}

export function useElectionResults(
  electionId: string,
  options: boolean | UseElectionResultsOptions = true
) {
  const resolvedOptions: UseElectionResultsOptions =
    typeof options === "boolean" ? { autoRefresh: options } : options;

  const {
    autoRefresh = true,
    intervalMs = 8_000,
    enabled = Boolean(electionId),
  } = resolvedOptions;

  return useQuery<ElectionResultsDTO, Error>({
    queryKey: queryKeys.election.results(electionId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (electionId && electionId !== "active") {
        params.set("electionId", electionId);
      }
      const query = params.toString();
      const res = await fetch(`/api/admin/results${query ? `?${query}` : ""}`);
      const json = (await res.json().catch(() => null)) as ApiResponse<ElectionResultsDTO> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memuat hasil pemilihan";
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
