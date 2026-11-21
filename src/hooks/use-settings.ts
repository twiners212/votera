"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateElectionScopes } from "@/lib/query-keys";
import type {
  ApiResponse,
  ElectionSettingsDTO,
  ElectionStatus,
} from "@/types/votera";

export interface ElectionSettingsFullResponse {
  election: {
    id: string;
    slug: string;
    shortName: string;
    title: string;
    organizationName: string;
    description: string | null;
    status: ElectionStatus;
    startAt: string | null;
    endAt: string | null;
    isActive: boolean;
  };
  settings: ElectionSettingsDTO;
}

export interface UpdateElectionSettingsInput {
  electionId?: string;
  shortName?: string;
  title?: string;
  organizationName?: string;
  description?: string | null;
  status?: ElectionStatus;
  startAt?: string | null;
  endAt?: string | null;
  idLabel?: string;
  groupLabel?: string;
  gradeLabel?: string;
  majorLabel?: string;
  isResultPublic?: boolean;
  logoUrl?: string | null;
  heroBannerUrl?: string | null;
}

export interface UseElectionSettingsOptions {
  autoRefresh?: boolean;
  intervalMs?: number;
  enabled?: boolean;
}

export function useElectionSettings(
  electionId: string = "active",
  options: UseElectionSettingsOptions = {}
) {
  const {
    autoRefresh = false,
    intervalMs = 30_000,
    enabled = Boolean(electionId),
  } = options;

  return useQuery<ElectionSettingsFullResponse, Error>({
    queryKey: queryKeys.election.settings(electionId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (electionId && electionId !== "active") {
        params.set("electionId", electionId);
      }
      const query = params.toString();
      const res = await fetch(`/api/admin/settings${query ? `?${query}` : ""}`);
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<ElectionSettingsFullResponse> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memuat pengaturan pemilihan";
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

export function useUpdateElectionSettings(electionId: string = "active") {
  const queryClient = useQueryClient();

  return useMutation<
    ElectionSettingsFullResponse,
    Error,
    UpdateElectionSettingsInput
  >({
    mutationFn: async (payload) => {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          electionId: payload.electionId || electionId,
        }),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<ElectionSettingsFullResponse> | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal memperbarui pengaturan pemilihan"
        );
      }

      return json.data;
    },
    onSuccess: async () => {
      await invalidateElectionScopes(queryClient, electionId, [
        "settings",
        "dashboard",
        "results",
        "logs",
      ]);
    },
  });
}

export interface ResetElectionMutationInput {
  targetElectionId?: string;
  confirmationText: string;
  password: string;
  deleteMasterData?: boolean;
  deleteCandidates?: boolean;
}

export interface ResetElectionMutationResponse {
  reset: boolean;
  electionId: string;
  status: string;
  deletedEntities: string[];
  message: string;
}

export function useResetElection(electionId?: string) {
  const queryClient = useQueryClient();

  return useMutation<
    ResetElectionMutationResponse,
    Error,
    ResetElectionMutationInput
  >({
    mutationFn: async (payload) => {
      const targetId = payload.targetElectionId || electionId;
      if (!targetId || targetId === "active") {
        throw new Error(
          "ID pemilihan (UUID) wajib disertakan untuk mereset data pemilihan."
        );
      }

      const res = await fetch("/api/admin/elections/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electionId: targetId,
          confirmationText: payload.confirmationText,
          password: payload.password,
          deleteMasterData: Boolean(payload.deleteMasterData),
          deleteCandidates: Boolean(payload.deleteCandidates),
        }),
      });

      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<ResetElectionMutationResponse> | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal mereset data pemilihan"
        );
      }

      return json.data;
    },
    onSuccess: async (data, variables) => {
      const targetId =
        variables.targetElectionId || electionId || data.electionId;
      await invalidateElectionScopes(queryClient, targetId, [
        "settings",
        "dashboard",
        "results",
        "candidates",
        "voters",
        "master",
        "logs",
      ]);
    },
  });
}
