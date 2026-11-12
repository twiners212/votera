"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/query-keys";
import type {
  ApiResponse,
  DashboardStatsDTO,
  ElectionStatus,
} from "@/types/votera";

const scheduleQuickSchema = z
  .object({
    status: z.enum(["draft", "open", "closed", "archived"]),
    startAt: z.string().min(1, "Waktu mulai wajib diisi"),
    endAt: z.string().min(1, "Waktu selesai wajib diisi"),
  })
  .refine(
    (values) => {
      const start = new Date(values.startAt).getTime();
      const end = new Date(values.endAt).getTime();
      return Number.isFinite(start) && Number.isFinite(end) && end > start;
    },
    {
      message: "Waktu selesai harus lebih akhir dari waktu mulai",
      path: ["endAt"],
    }
  );

type ScheduleQuickFormValues = z.infer<typeof scheduleQuickSchema>;

const STATUS_OPTIONS: Array<{ value: ElectionStatus; label: string }> = [
  { value: "draft", label: "Belum dibuka (Draft)" },
  { value: "open", label: "Dibuka (Berlangsung)" },
  { value: "closed", label: "Ditutup" },
  { value: "archived", label: "Diarsipkan" },
];

function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface ScheduleQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  election: DashboardStatsDTO["election"];
}

export function ScheduleQuickDialog({
  open,
  onOpenChange,
  election,
}: ScheduleQuickDialogProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<ScheduleQuickFormValues>({
    resolver: zodResolver(scheduleQuickSchema),
    defaultValues: {
      status: election.status,
      startAt: toDateTimeLocalValue(election.startAt),
      endAt: toDateTimeLocalValue(election.endAt),
    },
  });

  React.useEffect(() => {
    if (open) {
      setServerError(null);
      form.reset({
        status: election.status,
        startAt: toDateTimeLocalValue(election.startAt),
        endAt: toDateTimeLocalValue(election.endAt),
      });
    }
  }, [open, election.status, election.startAt, election.endAt, form]);

  const mutation = useMutation({
    mutationFn: async (values: ScheduleQuickFormValues) => {
      const payload = {
        electionId: election.id,
        status: values.status,
        startAt: new Date(values.startAt).toISOString(),
        endAt: new Date(values.endAt).toISOString(),
      };

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;

      if (!res.ok || !json || !json.success) {
        const message =
          json && !json.success
            ? json.error.message
            : "Gagal memperbarui jadwal pemilihan";
        throw new Error(message);
      }

      return json.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.election.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.election.dashboard("active"),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.election.dashboard(election.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.election.settings(election.id),
        }),
      ]);
      toast.success("Jadwal pemungutan suara berhasil diperbarui");
      onOpenChange(false);
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan jadwal";
      setServerError(message);
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    mutation.mutate(values);
  });

  const watchedStatus = form.watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Atur jadwal pemilihan</DialogTitle>
          <DialogDescription>
            Ubah status buka/tutup dan rentang waktu pemungutan suara untuk{" "}
            <span className="font-semibold text-[#0F172A]">{election.title}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#DC2626]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="schedule-status"
              className="text-xs font-semibold text-[#334155]"
            >
              Status pemungutan suara
            </label>
            <Select
              value={watchedStatus}
              onValueChange={(value) =>
                form.setValue("status", value as ElectionStatus, {
                  shouldValidate: true,
                })
              }
              disabled={mutation.isPending}
            >
              <SelectTrigger id="schedule-status">
                <SelectValue placeholder="Pilih status pemilihan" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.status && (
              <p className="text-xs text-[#DC2626]">
                {form.formState.errors.status.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="schedule-start-at"
                className="text-xs font-semibold text-[#334155]"
              >
                Waktu mulai
              </label>
              <Input
                id="schedule-start-at"
                type="datetime-local"
                className="tabular-nums"
                disabled={mutation.isPending}
                {...form.register("startAt")}
              />
              {form.formState.errors.startAt && (
                <p className="text-xs text-[#DC2626]">
                  {form.formState.errors.startAt.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="schedule-end-at"
                className="text-xs font-semibold text-[#334155]"
              >
                Waktu selesai
              </label>
              <Input
                id="schedule-end-at"
                type="datetime-local"
                className="tabular-nums"
                disabled={mutation.isPending}
                {...form.register("endAt")}
              />
              {form.formState.errors.endAt && (
                <p className="text-xs text-[#DC2626]">
                  {form.formState.errors.endAt.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Simpan jadwal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
