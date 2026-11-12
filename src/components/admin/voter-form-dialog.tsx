"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
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
import { useCreateVoter, useUpdateVoter } from "@/hooks/use-voters";
import type { VoterDTO, VoterGroupDTO } from "@/types/votera";

const voterFormSchema = z.object({
  voterIdentity: z
    .string()
    .trim()
    .min(3, "Identitas pemilih minimal 3 karakter")
    .max(50, "Identitas pemilih maksimal 50 karakter")
    .refine(
      (val) => !/^[=+\-@]/.test(val),
      "Karakter awal tidak diizinkan"
    ),
  name: z
    .string()
    .trim()
    .min(2, "Nama pemilih minimal 2 karakter")
    .max(120, "Nama pemilih maksimal 120 karakter")
    .refine(
      (val) => !/^[=+\-@]/.test(val),
      "Karakter awal tidak diizinkan"
    ),
  groupId: z.string().min(1, "Pilih kelas/rombel pemilih"),
});

type VoterFormValues = z.infer<typeof voterFormSchema>;

export interface VoterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  electionId: string;
  mode: "create" | "edit";
  voter?: VoterDTO | null;
  voterGroups: VoterGroupDTO[];
  idLabel?: string;
  groupLabel?: string;
}

export function VoterFormDialog({
  open,
  onOpenChange,
  electionId,
  mode,
  voter,
  voterGroups,
  idLabel = "NIS",
  groupLabel = "Rombel",
}: VoterFormDialogProps) {
  const createMutation = useCreateVoter(electionId);
  const updateMutation = useUpdateVoter(electionId);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const isEdit = mode === "edit" && Boolean(voter);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VoterFormValues>({
    resolver: zodResolver(voterFormSchema),
    defaultValues: {
      voterIdentity: "",
      name: "",
      groupId: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    if (isEdit && voter) {
      reset({
        voterIdentity: voter.voterIdentity,
        name: voter.name,
        groupId: voter.groupId,
      });
    } else {
      reset({
        voterIdentity: "",
        name: "",
        groupId: voterGroups[0]?.id ?? "",
      });
    }
  }, [open, isEdit, voter, voterGroups, reset]);

  async function onSubmit(values: VoterFormValues) {
    setSubmitError(null);
    try {
      if (isEdit && voter) {
        await updateMutation.mutateAsync({
          id: voter.id,
          voterIdentity: values.voterIdentity,
          name: values.name,
          groupId: values.groupId,
        });
        toast.success(`Data pemilih ${values.name} berhasil diperbarui`);
      } else {
        const created = await createMutation.mutateAsync({
          voterIdentity: values.voterIdentity,
          name: values.name,
          groupId: values.groupId,
        });
        toast.success(
          created.token
            ? `Pemilih ${created.name} ditambahkan dengan token ${created.token}`
            : `Pemilih ${created.name} berhasil ditambahkan`
        );
      }
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data pemilih";
      setSubmitError(message);
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Data Pemilih" : "Tambah Pemilih Baru"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Perbarui identitas atau ${groupLabel.toLowerCase()} pemilih terdaftar.`
              : "Sistem akan membuatkan token unik 8 karakter secara otomatis untuk pemilih baru."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#DC2626]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="voter-identity-field"
              className="block text-xs font-semibold text-[#334155]"
            >
              {idLabel}
            </label>
            <Input
              id="voter-identity-field"
              type="text"
              placeholder={`Contoh: 2324001`}
              className="font-mono tabular-nums"
              disabled={isSubmitting}
              {...register("voterIdentity")}
            />
            {errors.voterIdentity && (
              <p className="text-xs font-medium text-[#DC2626]">
                {errors.voterIdentity.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="voter-name-field"
              className="block text-xs font-semibold text-[#334155]"
            >
              Nama Lengkap
            </label>
            <Input
              id="voter-name-field"
              type="text"
              placeholder="Contoh: Putri Ayu Lestari"
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs font-medium text-[#DC2626]">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="voter-group-field"
              className="block text-xs font-semibold text-[#334155]"
            >
              {groupLabel}
            </label>
            <Controller
              name="groupId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting || voterGroups.length === 0}
                >
                  <SelectTrigger id="voter-group-field">
                    <SelectValue
                      placeholder={
                        voterGroups.length === 0
                          ? `Belum ada data ${groupLabel.toLowerCase()}`
                          : `Pilih ${groupLabel.toLowerCase()}`
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {voterGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                        {group.gradeName || group.majorName
                          ? ` (${[group.gradeName, group.majorName].filter(Boolean).join(" · ")})`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.groupId && (
              <p className="text-xs font-medium text-[#DC2626]">
                {errors.groupId.message}
              </p>
            )}
            {voterGroups.length === 0 && (
              <p className="text-xs text-[#B45309]">
                Data {groupLabel.toLowerCase()} belum tersedia. Pastikan master data sudah diisi.
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || voterGroups.length === 0}
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>{isEdit ? "Simpan perubahan" : "Tambah pemilih"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
