"use client";

import * as React from "react";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useResetElection } from "@/hooks/use-settings";

export interface ElectionResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  electionId: string;
  electionName?: string;
  onSuccess?: () => void;
}

const REQUIRED_CONFIRMATION_TEXT = "RESET PEMILIHAN";

export function ElectionResetDialog({
  open,
  onOpenChange,
  electionId,
  electionName,
  onSuccess,
}: ElectionResetDialogProps) {
  const [deleteMasterData, setDeleteMasterData] = React.useState(false);
  const [deleteCandidates, setDeleteCandidates] = React.useState(false);
  const [confirmationInput, setConfirmationInput] = React.useState("");
  const [adminPassword, setAdminPassword] = React.useState("");

  const resetMutation = useResetElection(electionId);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setDeleteMasterData(false);
      setDeleteCandidates(false);
      setConfirmationInput("");
      setAdminPassword("");
    }
  }, [open]);

  const isConfirmed =
    confirmationInput.trim() === REQUIRED_CONFIRMATION_TEXT &&
    adminPassword.trim().length > 0;

  const handleConfirmReset = async () => {
    if (!isConfirmed || resetMutation.isPending) return;

    try {
      await resetMutation.mutateAsync({
        targetElectionId: electionId,
        confirmationText: confirmationInput.trim(),
        password: adminPassword,
        deleteMasterData,
        deleteCandidates,
      });

      toast.success(
        "Data pemilihan berhasil dibersihkan. Status pemilihan dikembalikan ke Draft."
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mereset data pemilihan"
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (resetMutation.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg border-2 border-red-200 shadow-xl">
        <DialogHeader>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-600/30 ring-4 ring-red-100 mb-2">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogTitle className="text-base font-bold text-red-950">
            Bersihkan & Reset Data Pemilihan
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-[#475569]">
            {electionName
              ? `Anda akan mereset data pemilihan untuk "${electionName}". `
              : "Anda akan mereset data pemilihan ini. "}
            Tindakan ini bersifat destruktif dan permanen. Seluruh surat suara yang telah masuk akan dihapus dan tidak dapat dipulihkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning banner */}
          <div className="flex items-start gap-2.5 rounded-[10px] border-2 border-red-200 bg-red-50/90 p-3.5 text-xs text-red-900 shadow-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-950">Perhatian Kritis</p>
              <p className="text-[11px] leading-relaxed text-red-800">
                Setelah reset, status pemilihan akan otomatis dikembalikan ke{" "}
                <span className="font-semibold text-red-950">Draft</span> dan
                bilik suara terkunci. Seluruh sesi login pemilih akan hangus.
              </p>
            </div>
          </div>

          {/* Scope checkboxes */}
          <div className="space-y-3 rounded-[10px] border-2 border-red-100 bg-red-50/30 p-4">
            <p className="text-xs font-bold text-[#0F172A]">
              Cakupan Data yang Dihapus:
            </p>

            {/* 1. Suara & DPT (Wajib) */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="reset-votes-voters"
                checked={true}
                disabled={true}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="reset-votes-voters"
                  className="text-xs font-semibold text-[#0F172A]"
                >
                  Hapus Suara & DPT (Wajib)
                </label>
                <p className="text-[11px] text-[#64748B]">
                  Menghapus seluruh surat suara di kotak suara (votes), sesi login
                  pemilih, dan daftar pemilih (voters).
                </p>
              </div>
            </div>

            {/* 2. Rombel & Jurusan (Opsional) */}
            <div className="flex items-start gap-3 pt-1 border-t border-[#E2E8F0]">
              <Checkbox
                id="reset-master-data"
                checked={deleteMasterData}
                onCheckedChange={(checked) =>
                  setDeleteMasterData(Boolean(checked))
                }
                disabled={resetMutation.isPending}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="reset-master-data"
                  className="text-xs font-semibold text-[#0F172A] cursor-pointer"
                >
                  Hapus Rombel & Jurusan
                </label>
                <p className="text-[11px] text-[#64748B]">
                  Menghapus seluruh rombel (voter_groups) dan jurusan (majors) pada
                  pemilihan ini.
                </p>
              </div>
            </div>

            {/* 3. Kandidat (Opsional) */}
            <div className="flex items-start gap-3 pt-1 border-t border-[#E2E8F0]">
              <Checkbox
                id="reset-candidates"
                checked={deleteCandidates}
                onCheckedChange={(checked) =>
                  setDeleteCandidates(Boolean(checked))
                }
                disabled={resetMutation.isPending}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <label
                  htmlFor="reset-candidates"
                  className="text-xs font-semibold text-[#0F172A] cursor-pointer"
                >
                  Hapus Kandidat
                </label>
                <p className="text-[11px] text-[#64748B]">
                  Menghapus seluruh pasangan calon/kandidat yang terdaftar pada
                  pemilihan ini.
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation typing prompt */}
          <div className="space-y-2">
            <label
              htmlFor="confirm-reset-input"
              className="text-xs font-medium text-[#334155]"
            >
              Ketik <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">RESET PEMILIHAN</span> di bawah ini untuk konfirmasi:
            </label>
            <Input
              id="confirm-reset-input"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isConfirmed && !resetMutation.isPending) {
                  e.preventDefault();
                  void handleConfirmReset();
                }
              }}
              placeholder="RESET PEMILIHAN"
              className="h-10 rounded-[10px] border-[#CBD5E1] font-mono text-xs uppercase"
              disabled={resetMutation.isPending}
              autoComplete="off"
            />
          </div>

          {/* Super Admin Password (Sudo Confirmation) */}
          <div className="space-y-2">
            <label
              htmlFor="confirm-admin-password-input"
              className="text-xs font-medium text-[#334155]"
            >
              Password Super Admin (Konfirmasi Sudo):
            </label>
            <Input
              id="confirm-admin-password-input"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isConfirmed && !resetMutation.isPending) {
                  e.preventDefault();
                  void handleConfirmReset();
                }
              }}
              placeholder="Masukkan password akun Super Admin Anda"
              className="h-10 rounded-[10px] border-[#CBD5E1] text-xs"
              disabled={resetMutation.isPending}
              autoComplete="current-password"
            />
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={resetMutation.isPending}
            className="h-10 rounded-[10px] border-[#CBD5E1] text-xs font-semibold text-[#0F172A]"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirmReset}
            disabled={!isConfirmed || resetMutation.isPending}
            className="h-10 rounded-[10px] bg-[#DC2626] px-5 text-xs font-semibold text-white shadow-sm hover:bg-[#B91C1C] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {resetMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Mereset Data...</span>
              </>
            ) : (
              <span>Reset Data Pemilihan</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
