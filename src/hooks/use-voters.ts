"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys, invalidateElectionScopes } from "@/lib/query-keys";
import type {
  ApiResponse,
  VoterDTO,
  VoterFilterParams,
  VoterListResponseDTO,
} from "@/types/votera";

export interface UseVotersOptions {
  autoRefresh?: boolean;
  intervalMs?: 8_000 | 30_000;
  enabled?: boolean;
}

export interface CreateVoterInput {
  voterIdentity: string;
  name: string;
  groupId: string;
}

export interface UpdateVoterInput {
  id: string;
  voterIdentity?: string;
  name?: string;
  groupId?: string;
}

export interface ImportVoterRowInput {
  voterIdentity: string;
  name: string;
  groupName: string;
  gradeName?: string;
  majorName?: string;
}

export interface BulkImportVotersInput {
  rows: ImportVoterRowInput[];
  autoCreateGroups?: boolean;
}

export interface BulkImportVotersResult {
  totalProcessed: number;
  insertedCount: number;
  failedCount: number;
  failures: Array<{
    rowNumber: number;
    voterIdentity: string;
    reason: string;
  }>;
}

export interface BulkDeleteVotersInput {
  voterIds?: string[];
  allNotVoted?: boolean;
}

export interface BulkDeleteVotersResult {
  deletedCount: number;
}

export function useVoters(
  electionId: string,
  filters: VoterFilterParams = {},
  options: UseVotersOptions = {}
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
    status: filters.status ?? "all",
    groupId: filters.groupId ?? "all",
    gradeLevelId: filters.gradeLevelId ?? "all",
    majorId: filters.majorId ?? "all",
  };

  return useQuery<VoterListResponseDTO, Error>({
    queryKey: queryKeys.voters.list(electionId, normalizedFilters),
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
      if (normalizedFilters.status !== "all") {
        params.set("status", String(normalizedFilters.status));
      }
      if (normalizedFilters.groupId !== "all") {
        params.set("groupId", String(normalizedFilters.groupId));
      }
      if (normalizedFilters.gradeLevelId !== "all") {
        params.set("gradeLevelId", String(normalizedFilters.gradeLevelId));
      }
      if (normalizedFilters.majorId !== "all") {
        params.set("majorId", String(normalizedFilters.majorId));
      }

      const res = await fetch(`/api/admin/voters?${params.toString()}`);
      const json = (await res.json().catch(() => null)) as ApiResponse<VoterListResponseDTO> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memuat daftar pemilih";
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

function useInvalidateVoterQueries(electionId: string) {
  const queryClient = useQueryClient();

  return async () => {
    await invalidateElectionScopes(queryClient, electionId, [
      "voters",
      "dashboard",
      "results",
      "logs",
    ]);
  };
}

export function useCreateVoter(electionId: string) {
  const invalidate = useInvalidateVoterQueries(electionId);

  return useMutation<VoterDTO, Error, CreateVoterInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/admin/voters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, electionId }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<VoterDTO> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal menambahkan pemilih"
        );
      }
      return json.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateVoter(electionId: string) {
  const invalidate = useInvalidateVoterQueries(electionId);

  return useMutation<VoterDTO, Error, UpdateVoterInput>({
    mutationFn: async ({ id, ...payload }) => {
      const res = await fetch(`/api/admin/voters/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<VoterDTO> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal memperbarui data pemilih"
        );
      }
      return json.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteVoter(electionId: string) {
  const invalidate = useInvalidateVoterQueries(electionId);

  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (voterId) => {
      const res = await fetch(`/api/admin/voters/${encodeURIComponent(voterId)}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<{ id: string }> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal menghapus pemilih"
        );
      }
      return json.data;
    },
    onSuccess: invalidate,
  });
}

export function useResetVoterToken(electionId: string) {
  const invalidate = useInvalidateVoterQueries(electionId);

  return useMutation<
    { voterId: string; voterIdentity: string; newToken: string },
    Error,
    string
  >({
    mutationFn: async (voterId) => {
      const res = await fetch(
        `/api/admin/voters/${encodeURIComponent(voterId)}/reset-token`,
        { method: "POST" }
      );
      const json = (await res.json().catch(() => null)) as ApiResponse<{
        voterId: string;
        voterIdentity: string;
        newToken: string;
      }> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal mereset token pemilih"
        );
      }
      return json.data;
    },
    onSuccess: invalidate,
  });
}

export function useCopyVoterToken(electionId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    { voterId: string; voterIdentity: string; token: string },
    Error,
    string
  >({
    mutationFn: async (voterId) => {
      const res = await fetch(
        `/api/admin/voters/${encodeURIComponent(voterId)}/copy-token`,
        { method: "POST" }
      );
      const json = (await res.json().catch(() => null)) as ApiResponse<{
        voterId: string;
        voterIdentity: string;
        token: string;
      }> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal menyalin token pemilih"
        );
      }
      return json.data;
    },
    onSuccess: async () => {
      await invalidateElectionScopes(queryClient, electionId, ["logs"]);
    },
  });
}

export function useImportVoters(electionId: string) {
  const queryClient = useQueryClient();

  return useMutation<BulkImportVotersResult, Error, BulkImportVotersInput>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/admin/voters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, electionId }),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<BulkImportVotersResult> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal mengimpor data DPT"
        );
      }
      return json.data;
    },
    onSuccess: async () => {
      await invalidateElectionScopes(queryClient, electionId, [
        "voters",
        "dashboard",
        "results",
        "master",
        "logs",
      ]);
    },
  });
}

export function useBulkDeleteVoters(electionId: string) {
  const queryClient = useQueryClient();

  return useMutation<BulkDeleteVotersResult, Error, BulkDeleteVotersInput>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/admin/voters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, electionId }),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<BulkDeleteVotersResult> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal menghapus pemilih secara massal"
        );
      }
      return json.data;
    },
    onSuccess: async () => {
      await invalidateElectionScopes(queryClient, electionId, [
        "voters",
        "dashboard",
        "results",
        "logs",
      ]);
    },
  });
}
