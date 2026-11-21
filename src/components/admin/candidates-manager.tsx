"use client";

import * as React from "react";
import Image from "next/image";
import { AlertCircle, Plus, RefreshCw, Users } from "lucide-react";
import { CandidateDeleteDialog } from "@/components/admin/candidate-delete-dialog";
import { CandidateFormDialog } from "@/components/admin/candidate-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCandidates } from "@/hooks/use-candidates";
import type { AdminRole, CandidateDTO } from "@/types/votera";

function getFallbackCandidatePhoto(candidateNumber: number): string {
  const safeNumber =
    Number.isFinite(candidateNumber) && candidateNumber > 0
      ? candidateNumber
      : 1;
  const index = ((safeNumber - 1) % 4) + 1;
  return `/images/candidate-${index}.jpg`;
}

function CandidateThumbnail({
  photoUrl,
  candidateNumber,
  name,
}: {
  photoUrl: string | null;
  candidateNumber: number;
  name: string;
}) {
  const fallbackSrc = getFallbackCandidatePhoto(candidateNumber);
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    setHasError(false);
  }, [photoUrl, candidateNumber]);

  const resolvedSrc =
    !hasError && photoUrl && photoUrl.trim().length > 0
      ? photoUrl
      : fallbackSrc;

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC]">
      <Image
        src={resolvedSrc}
        alt={`Foto ${name}`}
        width={40}
        height={40}
        unoptimized
        onError={() => {
          if (!hasError) {
            setHasError(true);
          }
        }}
        className="h-10 w-10 object-cover"
      />
    </div>
  );
}

function CandidatesTableSkeleton({
  isSuperAdmin = true,
}: {
  isSuperAdmin?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC]/60 px-5 py-3.5">
        <div className="h-3 w-48 animate-pulse rounded bg-[#E2E8F0]" />
      </div>
      <div className="divide-y divide-[#F1F5F9]">
        {[1, 2, 3, 4].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-7 w-9 animate-pulse rounded-[6px] bg-[#FFF0EE]" />
              <div className="h-10 w-10 animate-pulse rounded-[10px] bg-[#F1F5F9]" />
              <div className="space-y-1.5">
                <div className="h-4 w-40 animate-pulse rounded bg-[#E2E8F0]" />
                <div className="h-3 w-52 animate-pulse rounded bg-[#F1F5F9]" />
              </div>
            </div>
            <div className="hidden h-4 w-16 animate-pulse rounded bg-[#F1F5F9] sm:block" />
            <div className="hidden h-4 w-44 animate-pulse rounded bg-[#F1F5F9] md:block" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-[#DCFCE7]" />
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-14 animate-pulse rounded-[8px] bg-[#F1F5F9]" />
                <div className="h-8 w-16 animate-pulse rounded-[8px] bg-[#FEE2E2]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface CandidatesManagerProps {
  electionId?: string;
  role?: AdminRole;
}

export function CandidatesManager({
  electionId = "active",
  role = "committee",
}: CandidatesManagerProps) {
  const isSuperAdmin = role === "super_admin";

  const {
    data: candidates,
    isLoading,
    isError,
    error,
    refetch,
  } = useCandidates(electionId);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingCandidate, setEditingCandidate] =
    React.useState<CandidateDTO | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletingCandidate, setDeletingCandidate] =
    React.useState<CandidateDTO | null>(null);

  const sortedCandidates = React.useMemo(() => {
    if (!candidates) return [];
    return [...candidates].sort(
      (a, b) => a.candidateNumber - b.candidateNumber
    );
  }, [candidates]);

  const activeCount = React.useMemo(
    () => sortedCandidates.filter((c) => c.isActive).length,
    [sortedCandidates]
  );

  const nextCandidateNumber = React.useMemo(() => {
    if (sortedCandidates.length === 0) return 1;
    const maxNum = sortedCandidates.reduce(
      (max, c) => Math.max(max, c.candidateNumber),
      0
    );
    return Math.min(99, maxNum + 1);
  }, [sortedCandidates]);

  function handleAddClick() {
    if (!isSuperAdmin) return;
    setEditingCandidate(null);
    setFormOpen(true);
  }

  function handleEditClick(candidate: CandidateDTO) {
    if (!isSuperAdmin) return;
    setEditingCandidate(candidate);
    setFormOpen(true);
  }

  function handleDeleteClick(candidate: CandidateDTO) {
    if (!isSuperAdmin) return;
    setDeletingCandidate(candidate);
    setDeleteOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header Baris Aksi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Kandidat
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            <span className="font-semibold text-[#0F172A] tabular-nums">
              {sortedCandidates.length}
            </span>{" "}
            kandidat terdaftar,{" "}
            <span className="font-semibold text-[#0F172A] tabular-nums">
              {activeCount}
            </span>{" "}
            aktif. Hanya kandidat aktif yang tampil di surat suara.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <Button type="button" onClick={handleAddClick}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Tambah kandidat</span>
            </Button>
          )}
        </div>
      </div>

      {/* Konten Utama */}
      {isLoading ? (
        <CandidatesTableSkeleton isSuperAdmin={isSuperAdmin} />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-[16px] border border-[#FECACA] bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-bold text-[#0F172A]">
            Gagal memuat daftar kandidat
          </h2>
          <p className="mt-1 max-w-md text-xs text-[#64748B]">
            {error?.message ||
              "Terjadi kendala saat mengambil data kandidat dari server."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-4"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Muat ulang</span>
          </Button>
        </div>
      ) : sortedCandidates.length === 0 ? (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title="Belum ada kandidat terdaftar"
            description="Tambahkan minimal 2 kandidat aktif beserta visi, misi, dan program kerjanya sebelum pemungutan suara dibuka."
            action={
              isSuperAdmin ? (
                <Button type="button" size="sm" onClick={handleAddClick}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Tambah kandidat</span>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 py-3.5">Kandidat</TableHead>
                <TableHead className="px-5 py-3.5">Kelas</TableHead>
                <TableHead className="px-5 py-3.5">Kelengkapan</TableHead>
                <TableHead className="px-5 py-3.5">Status</TableHead>
                {isSuperAdmin && (
                  <TableHead className="px-5 py-3.5 text-right">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCandidates.map((candidate) => (
                <TableRow key={candidate.id} className="hover:bg-[#FAF9F7]">
                  <TableCell className="px-5 py-4">
                    <div className="flex items-center gap-3.5">
                      <span className="inline-flex shrink-0 items-center justify-center rounded-[6px] bg-[#FFF0EE] px-2 py-1 font-mono text-xs font-bold text-[#D93829] tabular-nums">
                        #{candidate.candidateNumber}
                      </span>

                      <CandidateThumbnail
                        photoUrl={candidate.photoUrl}
                        candidateNumber={candidate.candidateNumber}
                        name={candidate.name}
                      />

                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#0F172A]">
                          {candidate.name}
                        </div>
                        <div className="max-w-[260px] truncate text-xs text-[#64748B] sm:max-w-[340px]">
                          {candidate.motto}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="whitespace-nowrap px-5 py-4 text-sm font-medium text-[#0F172A]">
                    {candidate.classOrUnit}
                  </TableCell>

                  <TableCell className="whitespace-nowrap px-5 py-4 text-sm text-[#64748B] tabular-nums">
                    <span className="tabular-nums">
                      {candidate.missions.length}
                    </span>{" "}
                    misi,{" "}
                    <span className="tabular-nums">
                      {candidate.programs.length}
                    </span>{" "}
                    program,{" "}
                    <span className="tabular-nums">
                      {candidate.supporters.length}
                    </span>{" "}
                    pendukung
                  </TableCell>

                  <TableCell className="whitespace-nowrap px-5 py-4">
                    <StatusPill
                      status={candidate.isActive ? "active" : "inactive"}
                      label={candidate.isActive ? "Aktif" : "Nonaktif"}
                      size="sm"
                    />
                  </TableCell>

                  {isSuperAdmin && (
                    <TableCell className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(candidate)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="softDanger"
                          size="sm"
                          onClick={() => handleDeleteClick(candidate)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footer Admin */}
      <footer className="pb-4 pt-2 text-center">
        <p className="text-xs text-[#94A3B8]">
          &copy; 2026 Votera &mdash; Panel Manajemen Kandidat
        </p>
      </footer>

      {/* Modal Tambah / Edit Kandidat */}
      {isSuperAdmin && (
        <CandidateFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          candidate={editingCandidate}
          nextCandidateNumber={nextCandidateNumber}
          electionId={electionId}
        />
      )}

      {/* Dialog Konfirmasi Hapus Kandidat */}
      {isSuperAdmin && (
        <CandidateDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          candidate={deletingCandidate}
          electionId={electionId}
        />
      )}
    </div>
  );
}
