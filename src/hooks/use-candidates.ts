"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys, invalidateElectionScopes } from "@/lib/query-keys";
import type {
  ApiResponse,
  CandidateDTO,
  CandidateTheme,
} from "@/types/votera";

export interface UseCandidatesOptions {
  autoRefresh?: boolean;
  intervalMs?: 8_000 | 30_000;
  enabled?: boolean;
}

export interface CandidateFormInput {
  candidateNumber: number;
  name: string;
  classOrUnit: string;
  motto: string;
  vision: string;
  missions: string[];
  programs: string[];
  supporters: string[];
  photoUrl: string | null;
  themeColor: CandidateTheme;
  isActive: boolean;
}

export function useCandidates(
  electionId: string,
  options: UseCandidatesOptions = {}
) {
  const {
    autoRefresh = false,
    intervalMs = 30_000,
    enabled = Boolean(electionId),
  } = options;

  return useQuery<CandidateDTO[], Error>({
    queryKey: queryKeys.candidates.all(electionId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (electionId && electionId !== "active") {
        params.set("electionId", electionId);
      }
      const query = params.toString();
      const res = await fetch(`/api/admin/candidates${query ? `?${query}` : ""}`);
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<CandidateDTO[]> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memuat daftar kandidat";
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

function useInvalidateCandidateQueries(electionId: string) {
  const queryClient = useQueryClient();

  return async () => {
    await invalidateElectionScopes(queryClient, electionId, [
      "candidates",
      "dashboard",
      "results",
      "logs",
    ]);
  };
}

export function useCreateCandidate(electionId: string) {
  const invalidate = useInvalidateCandidateQueries(electionId);

  return useMutation<CandidateDTO, Error, CandidateFormInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/admin/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, electionId }),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<CandidateDTO> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal menambahkan kandidat"
        );
      }
      return json.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateCandidate(electionId: string) {
  const invalidate = useInvalidateCandidateQueries(electionId);

  return useMutation<
    CandidateDTO,
    Error,
    Partial<CandidateFormInput> & { id: string }
  >({
    mutationFn: async ({ id, ...payload }) => {
      const res = await fetch(`/api/admin/candidates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<CandidateDTO> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal memperbarui data kandidat"
        );
      }
      return json.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteCandidate(electionId: string) {
  const invalidate = useInvalidateCandidateQueries(electionId);

  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (candidateId) => {
      const res = await fetch(
        `/api/admin/candidates/${encodeURIComponent(candidateId)}`,
        { method: "DELETE" }
      );
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<{ id: string }> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal menghapus kandidat"
        );
      }
      return json.data;
    },
    onSuccess: invalidate,
  });
}

export function useUploadCandidatePhoto(electionId?: string) {
  return useMutation<{ url: string }, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      if (electionId && electionId !== "active") {
        formData.append("electionId", electionId);
      }

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json().catch(() => null)) as
        | (ApiResponse<{ url: string }> & { url?: string })
        | { url?: string }
        | null;

      let uploadedUrl: string | undefined;
      if (json && "success" in json) {
        if (!res.ok || !json.success) {
          throw new Error(
            !json.success ? json.error.message : "Gagal mengunggah gambar"
          );
        }
        uploadedUrl = json.data?.url ?? json.url;
      } else if (res.ok && json && "url" in json && typeof json.url === "string") {
        uploadedUrl = json.url;
      }

      if (!res.ok || !uploadedUrl) {
        throw new Error("Gagal mengunggah gambar");
      }

      return { url: uploadedUrl };
    },
  });
}

/**
 * Alias generik untuk pengunggahan media panel admin (Logo, Banner, Foto Kandidat).
 * Menggunakan endpoint dan backend pipeline yang sama dengan useUploadCandidatePhoto.
 */
export const useAdminUpload = useUploadCandidatePhoto;
