"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { AdminRole, ApiResponse } from "@/types/votera";

export interface AdminUserDTO {
  id: string;
  name: string;
  email: string;
  username: string;
  displayUsername?: string;
  role: AdminRole;
  banned: boolean;
  banReason?: string | null;
  banExpires?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminUserInput {
  name: string;
  email: string;
  username: string;
  password: string;
  role: AdminRole;
}

export interface UpdateAdminUserInput {
  id: string;
  name?: string;
  email?: string;
  role?: AdminRole;
  password?: string;
  banned?: boolean;
}

export interface UseAdminUsersOptions {
  autoRefresh?: boolean;
  intervalMs?: number;
  enabled?: boolean;
}

export function useAdminUsers(options: UseAdminUsersOptions = {}) {
  const { autoRefresh = false, intervalMs = 30_000, enabled = true } = options;

  return useQuery<AdminUserDTO[], Error>({
    queryKey: queryKeys.admin.users(),
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<AdminUserDTO[]> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memuat daftar pengguna admin";
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

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation<AdminUserDTO, Error, CreateAdminUserInput>({
    mutationFn: async (input) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<AdminUserDTO> | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal membuat pengguna admin"
        );
      }

      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() }),
        queryClient.invalidateQueries({ queryKey: ["logs"] }),
      ]);
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation<AdminUserDTO, Error, UpdateAdminUserInput>({
    mutationFn: async ({ id, ...payload }) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<AdminUserDTO> | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal memperbarui pengguna admin"
        );
      }

      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() }),
        queryClient.invalidateQueries({ queryKey: ["logs"] }),
      ]);
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (userId) => {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse<{ id: string }> | null;

      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success
            ? json.error.message
            : "Gagal menghapus pengguna admin"
        );
      }

      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() }),
        queryClient.invalidateQueries({ queryKey: ["logs"] }),
      ]);
    },
  });
}
