"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type {
  ApiResponse,
  AuditLogFilterParams,
  AuditLogListResponseDTO,
} from "@/types/votera";

export interface UseAuditLogsOptions {
  autoRefresh?: boolean;
  intervalMs?: 8_000 | 30_000;
  enabled?: boolean;
}

export function useAuditLogs(
  electionId: string,
  filters: AuditLogFilterParams = {},
  options: UseAuditLogsOptions = {}
) {
  const {
    autoRefresh = false,
    intervalMs = 30_000,
    enabled = Boolean(electionId),
  } = options;

  const normalizedFilters: Record<string, unknown> = {
    page: filters.page ?? 1,
    limit: filters.limit ?? 25,
    search: filters.search?.trim() || "",
    actorType: filters.actorType ?? "all",
    action: filters.action ?? "all",
    dateFrom: filters.dateFrom ?? "",
    dateTo: filters.dateTo ?? "",
  };

  return useQuery<AuditLogListResponseDTO, Error>({
    queryKey: queryKeys.logs.list(electionId, normalizedFilters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (electionId && electionId !== "active") {
        params.set("electionId", electionId);
      }
      params.set("page", String(normalizedFilters.page));
      params.set("limit", String(normalizedFilters.limit));
      if (normalizedFilters.search) {
        params.set("search", String(normalizedFilters.search));
      }
      if (normalizedFilters.actorType !== "all") {
        params.set("actorType", String(normalizedFilters.actorType));
      }
      if (normalizedFilters.action !== "all") {
        params.set("action", String(normalizedFilters.action));
      }
      if (normalizedFilters.dateFrom) {
        params.set("dateFrom", String(normalizedFilters.dateFrom));
      }
      if (normalizedFilters.dateTo) {
        params.set("dateTo", String(normalizedFilters.dateTo));
      }

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<AuditLogListResponseDTO> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memuat catatan aktivitas";
        throw new Error(message);
      }

      return json.data;
    },
    enabled,
    staleTime: 4_000,
    refetchInterval: autoRefresh ? intervalMs : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
