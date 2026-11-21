"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateElectionScopes } from "@/lib/query-keys";
import type {
  ApiResponse,
  GradeLevelDTO,
  MajorDTO,
  MasterDataDTO,
  VoterGroupDTO,
} from "@/types/votera";

export interface UseMasterDataOptions {
  autoRefresh?: boolean;
  intervalMs?: number;
  enabled?: boolean;
}

export type MasterCreateInput =
  | {
      entity: "grade";
      name: string;
      sortOrder?: number;
    }
  | {
      entity: "major";
      name: string;
      code?: string | null;
      sortOrder?: number;
    }
  | {
      entity: "group";
      name: string;
      gradeLevelId?: string | null;
      majorId?: string | null;
      sortOrder?: number;
    };

export type MasterUpdateInput =
  | {
      entity: "grade";
      id: string;
      name?: string;
      sortOrder?: number;
    }
  | {
      entity: "major";
      id: string;
      name?: string;
      code?: string | null;
      sortOrder?: number;
    }
  | {
      entity: "group";
      id: string;
      name?: string;
      gradeLevelId?: string | null;
      majorId?: string | null;
      sortOrder?: number;
    };

export interface MasterDeleteInput {
  entity: "grade" | "major" | "group";
  id: string;
}

export function useMasterData(
  electionId: string = "active",
  options: UseMasterDataOptions = {}
) {
  const {
    autoRefresh = false,
    intervalMs = 30_000,
    enabled = Boolean(electionId),
  } = options;

  return useQuery<MasterDataDTO, Error>({
    queryKey: queryKeys.master.all(electionId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (electionId && electionId !== "active") {
        params.set("electionId", electionId);
      }
      const query = params.toString();
      const res = await fetch(`/api/admin/master${query ? `?${query}` : ""}`);
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<MasterDataDTO> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memuat data master";
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

export function useCreateMasterItem(electionId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    GradeLevelDTO | MajorDTO | VoterGroupDTO,
    Error,
    MasterCreateInput
  >({
    mutationFn: async (input) => {
      const res = await fetch("/api/admin/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, electionId }),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<
        GradeLevelDTO | MajorDTO | VoterGroupDTO
      > | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal menambahkan data master"
        );
      }
      return json.data;
    },
    onSuccess: async () => {
      await invalidateElectionScopes(queryClient, electionId, [
        "master",
        "voters",
        "results",
        "dashboard",
        "logs",
      ]);
    },
  });
}

export function useUpdateMasterItem(electionId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    GradeLevelDTO | MajorDTO | VoterGroupDTO,
    Error,
    MasterUpdateInput
  >({
    mutationFn: async (input) => {
      const res = await fetch("/api/admin/master", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<
        GradeLevelDTO | MajorDTO | VoterGroupDTO
      > | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal memperbarui data master"
        );
      }
      return json.data;
    },
    onSuccess: async () => {
      await invalidateElectionScopes(queryClient, electionId, [
        "master",
        "voters",
        "results",
        "dashboard",
        "logs",
      ]);
    },
  });
}

export function useDeleteMasterItem(electionId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, MasterDeleteInput>({
    mutationFn: async ({ entity, id }) => {
      const params = new URLSearchParams({
        entity,
        id,
      });
      if (electionId && electionId !== "active") {
        params.set("electionId", electionId);
      }
      const res = await fetch(`/api/admin/master?${params.toString()}`, {
        method: "DELETE",
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<{ id: string }> | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal menghapus data master"
        );
      }
      return json.data;
    },
    onSuccess: async () => {
      await invalidateElectionScopes(queryClient, electionId, [
        "master",
        "voters",
        "results",
        "dashboard",
        "logs",
      ]);
    },
  });
}
