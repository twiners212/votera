"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
const DptImportDialog = dynamic(
  () =>
    import("@/components/admin/dpt-import-dialog").then(
      (m) => m.DptImportDialog
    ),
  { ssr: false }
);
import { KpiStatCard } from "@/components/admin/kpi-stat-card";
import { TokenCopyBadge } from "@/components/admin/token-copy-badge";
import { VoterFilterBar } from "@/components/admin/voter-filter-bar";
import { VoterFormDialog } from "@/components/admin/voter-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusPill } from "@/components/shared/status-pill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import {
  useBulkDeleteVoters,
  useDeleteVoter,
  useResetVoterToken,
  useVoters,
} from "@/hooks/use-voters";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type {
  AdminRole,
  ApiResponse,
  MasterDataDTO,
  VoterDTO,
  VoterFilterParams,
} from "@/types/votera";

const DEFAULT_FILTERS: VoterFilterParams = {
  page: 1,
  limit: 25,
  search: "",
  status: "all",
  groupId: "all",
  gradeLevelId: "all",
  majorId: "all",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function buildPageNumbers(current: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const start = Math.max(1, Math.min(current - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

export interface VotersManagerProps {
  electionId?: string;
  role?: AdminRole;
}

export function VotersManager({
  electionId = "active",
  role = "committee",
}: VotersManagerProps) {
  const isSuperAdmin = role === "super_admin";

  const [filters, setFilters] = React.useState<VoterFilterParams>(DEFAULT_FILTERS);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [editingVoter, setEditingVoter] = React.useState<VoterDTO | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  const [resetTarget, setResetTarget] = React.useState<VoterDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<VoterDTO | null>(null);

  const [selectedVoterIds, setSelectedVoterIds] = React.useState<Set<string>>(
    new Set()
  );
  const [bulkDeleteTarget, setBulkDeleteTarget] = React.useState<
    "selected" | "all_not_voted" | null
  >(null);

  const votersQuery = useVoters(electionId, filters);
  const dashboardQuery = useDashboardStats(electionId, { autoRefresh: false });

  const masterQuery = useQuery<MasterDataDTO, Error>({
    queryKey: queryKeys.master.all(electionId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (electionId && electionId !== "active") {
        params.set("electionId", electionId);
      }
      const query = params.toString();
      const res = await fetch(`/api/admin/master${query ? `?${query}` : ""}`);
      const json = (await res.json().catch(() => null)) as ApiResponse<MasterDataDTO> | null;
      if (!res.ok || !json || !json.success) {
        throw new Error(
          json && !json.success ? json.error.message : "Gagal memuat data master"
        );
      }
      return json.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const resetTokenMutation = useResetVoterToken(electionId);
  const deleteVoterMutation = useDeleteVoter(electionId);
  const bulkDeleteMutation = useBulkDeleteVoters(electionId);

  // Clear selection on filter / page change
  React.useEffect(() => {
    setSelectedVoterIds(new Set());
  }, [filters]);

  const settings = dashboardQuery.data?.election.settings;
  const idLabel = settings?.idLabel ?? "NIS";
  const groupLabel = settings?.groupLabel ?? "Rombel";
  const gradeLabel = settings?.gradeLabel ?? "Tingkat";
  const majorLabel = settings?.majorLabel ?? "Jurusan";

  const masterData = masterQuery.data ?? {
    gradeLevels: [],
    majors: [],
    voterGroups: [],
  };

  const voters = votersQuery.data?.voters ?? [];
  const summary = votersQuery.data?.summary ?? {
    totalVoters: 0,
    votesCast: 0,
    notVoted: 0,
    turnoutPercentage: 0,
  };
  const meta = votersQuery.data?.meta ?? {
    page: filters.page ?? 1,
    limit: filters.limit ?? 25,
    total: 0,
    totalPages: 1,
  };

  const selectableVotersOnPage = voters.filter((v) => !v.hasVoted);
  const allSelectableOnPageSelected =
    selectableVotersOnPage.length > 0 &&
    selectableVotersOnPage.every((v) => selectedVoterIds.has(v.id));

  function handleToggleSelectAllOnPage() {
    setSelectedVoterIds((prev) => {
      const next = new Set(prev);
      if (allSelectableOnPageSelected) {
        selectableVotersOnPage.forEach((v) => next.delete(v.id));
      } else {
        selectableVotersOnPage.forEach((v) => next.add(v.id));
      }
      return next;
    });
  }

  function handleToggleSelectVoter(voterId: string) {
    setSelectedVoterIds((prev) => {
      const next = new Set(prev);
      if (next.has(voterId)) {
        next.delete(voterId);
      } else {
        next.add(voterId);
      }
      return next;
    });
  }

  async function handleConfirmBulkDelete() {
    if (!bulkDeleteTarget) return;

    try {
      let result: { deletedCount: number };
      if (bulkDeleteTarget === "selected") {
        const ids = Array.from(selectedVoterIds);
        if (ids.length === 0) return;
        result = await bulkDeleteMutation.mutateAsync({ voterIds: ids });
        setSelectedVoterIds(new Set());
      } else {
        result = await bulkDeleteMutation.mutateAsync({ allNotVoted: true });
        setSelectedVoterIds(new Set());
      }

      toast.success(`Berhasil menghapus ${result.deletedCount} pemilih dari DPT`);
      setBulkDeleteTarget(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus pemilih secara massal";
      toast.error(message);
    }
  }

  const startItem =
    meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const endItem = Math.min(meta.total, meta.page * meta.limit);
  const totalPages = Math.max(1, meta.totalPages);
  const pageNumbers = buildPageNumbers(meta.page, totalPages);

  function handleOpenCreate() {
    setFormMode("create");
    setEditingVoter(null);
    setFormOpen(true);
  }

  function handleOpenEdit(voter: VoterDTO) {
    setFormMode("edit");
    setEditingVoter(voter);
    setFormOpen(true);
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  async function handleConfirmResetToken() {
    if (!resetTarget || resetTarget.hasVoted) return;
    const target = resetTarget;
    try {
      const result = await resetTokenMutation.mutateAsync(target.id);
      toast.success(
        `Token baru untuk ${target.name}: ${result.newToken}`
      );
      setResetTarget(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mereset token pemilih";
      toast.error(message);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteTarget.hasVoted) return;
    const target = deleteTarget;
    try {
      await deleteVoterMutation.mutateAsync(target.id);
      toast.success(`Pemilih ${target.name} berhasil dihapus dari DPT`);
      setDeleteTarget(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menghapus pemilih";
      toast.error(message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Header & Action Triggers */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">
              {dashboardQuery.data?.election.shortName ?? "PILKETOS 2026"}
            </Badge>
            <span className="text-xs font-medium text-[#64748B] tabular-nums">
              {summary.totalVoters} pemilih terdaftar
            </span>
          </div>
          <p className="text-sm text-[#64748B]">
            Daftar pemilih tetap (DPT). Pemilih masuk menggunakan {idLabel} dan
            token unik sekali pakai.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
          {isSuperAdmin && summary.notVoted > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDeleteTarget("all_not_voted")}
              className="text-xs font-semibold text-[#DC2626] border-[#FECACA] hover:bg-[#FEE2E2]"
              title="Hapus semua pemilih yang belum memilih dari DPT"
            >
              <Trash2 className="h-4 w-4 text-[#DC2626]" aria-hidden="true" />
              <span>Hapus Semua Belum Memilih</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
            <span>Import DPT</span>
          </Button>
          <Button type="button" onClick={handleOpenCreate}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>+ Tambah pemilih</span>
          </Button>
        </div>
      </div>

      {/* Section 2: 4 Compact KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiStatCard
          variant="compact"
          label="Total pemilih"
          value={summary.totalVoters}
          subtext={`Terdaftar dalam DPT`}
        />
        <KpiStatCard
          variant="compact"
          label="Sudah memilih"
          value={summary.votesCast}
          valueClassName="text-[#15803D]"
          subtext="Surat suara masuk"
        />
        <KpiStatCard
          variant="compact"
          label="Belum memilih"
          value={summary.notVoted}
          subtext="Menunggu pemberian suara"
        />
        <KpiStatCard
          variant="compact"
          label="% Partisipasi"
          value={formatPercent(summary.turnoutPercentage)}
          progressValue={summary.turnoutPercentage}
          progressIndicatorClassName="bg-[#16A34A]"
        />
      </div>

      {/* Section 3: 5-Column Filter Bar */}
      <VoterFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetFilters}
        gradeLevels={masterData.gradeLevels}
        majors={masterData.majors}
        voterGroups={masterData.voterGroups}
        idLabel={idLabel}
        groupLabel={groupLabel}
        gradeLabel={gradeLabel}
        majorLabel={majorLabel}
      />

      {/* Section 4: DPT Data Table */}
      <div className="overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col justify-between gap-2 border-b border-[#E2E8F0] bg-white px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-[#0F172A]">
              Daftar pemilih
            </h3>
            <Badge variant="secondary" className="tabular-nums">
              Total {meta.total} Terdata
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#64748B] tabular-nums">
            <span>
              Menampilkan{" "}
              <span className="font-semibold text-[#0F172A]">
                {startItem}-{endItem}
              </span>{" "}
              dari {meta.total}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void votersQuery.refetch()}
              disabled={votersQuery.isFetching}
              aria-label="Segarkan daftar pemilih"
              className="h-7 px-2 text-xs text-[#64748B]"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  votersQuery.isFetching && "animate-spin"
                )}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        {isSuperAdmin && selectedVoterIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FECACA] bg-[#FFF5F3] px-5 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-[#D93829] tabular-nums">
                {selectedVoterIds.size} pemilih dipilih
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedVoterIds(new Set())}
                className="h-7 px-2 text-xs text-[#64748B] hover:text-[#0F172A]"
              >
                Batal pilih
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setBulkDeleteTarget("selected")}
              className="h-8 gap-1.5 rounded-[8px] bg-[#DC2626] px-3 text-xs font-semibold text-white hover:bg-[#B91C1C]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hapus ({selectedVoterIds.size}) Terpilih</span>
            </Button>
          </div>
        )}

        {votersQuery.isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-11 w-full animate-pulse rounded-[8px] bg-[#F1F5F9]"
              />
            ))}
          </div>
        ) : votersQuery.isError ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">
              Gagal memuat data pemilih
            </p>
            <p className="mt-1 max-w-md text-xs text-[#64748B]">
              {votersQuery.error.message}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void votersQuery.refetch()}
              className="mt-4"
            >
              Coba lagi
            </Button>
          </div>
        ) : voters.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title="Data pemilih tidak ditemukan"
            description="Belum ada pemilih yang cocok dengan filter aktif, atau DPT masih kosong."
            onReset={handleResetFilters}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {isSuperAdmin && (
                  <TableHead className="w-12 py-3 px-3">
                    <Checkbox
                      checked={allSelectableOnPageSelected}
                      onCheckedChange={handleToggleSelectAllOnPage}
                      disabled={selectableVotersOnPage.length === 0}
                      aria-label="Pilih semua pemilih di halaman ini"
                    />
                  </TableHead>
                )}
                <TableHead className="w-32 py-3 px-4">{idLabel}</TableHead>
                <TableHead className="py-3 px-4">Nama</TableHead>
                <TableHead className="w-36 py-3 px-4">{groupLabel}</TableHead>
                <TableHead className="w-48 py-3 px-4">Token</TableHead>
                <TableHead className="w-48 py-3 px-4">Status</TableHead>
                <TableHead className="w-56 py-3 px-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {voters.map((voter) => {
                const timestamp = voter.hasVoted
                  ? formatDateTime(voter.votedAt)
                  : voter.voterStatus === "logged_in"
                    ? formatDateTime(voter.lastLoginAt)
                    : "";

                return (
                  <TableRow key={voter.id} className="h-14 hover:bg-[#FAF9F7]">
                    {isSuperAdmin && (
                      <TableCell className="w-12 py-3 px-3">
                        <Checkbox
                          checked={selectedVoterIds.has(voter.id)}
                          onCheckedChange={() => handleToggleSelectVoter(voter.id)}
                          disabled={voter.hasVoted}
                          aria-label={`Pilih ${voter.name}`}
                          title={
                            voter.hasVoted
                              ? "Pemilih yang sudah memilih tidak dapat dihapus"
                              : "Pilih pemilih"
                          }
                        />
                      </TableCell>
                    )}
                    <TableCell className="py-3 px-4 font-mono text-xs font-semibold tabular-nums text-[#334155]">
                      {voter.voterIdentity}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#0F172A]">
                          {voter.name}
                        </span>
                        {voter.hasVoted && (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-[#16A34A]"
                            aria-label="Sudah menggunakan hak pilih"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-xs font-medium text-[#475569]">
                      {voter.groupName}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <TokenCopyBadge
                        token={voter.token}
                        hasVoted={voter.hasVoted}
                      />
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="space-y-1">
                        <StatusPill status={voter.voterStatus} size="sm" />
                        {timestamp && (
                          <div className="pl-1 text-xs text-[#64748B] tabular-nums">
                            {timestamp}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={voter.hasVoted}
                          onClick={() => handleOpenEdit(voter)}
                          title={
                            voter.hasVoted
                              ? "Pemilih yang sudah memilih tidak dapat diedit"
                              : "Edit data pemilih"
                          }
                          className="text-xs font-medium text-[#334155]"
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={voter.hasVoted}
                          onClick={() => setResetTarget(voter)}
                          title={
                            voter.hasVoted
                              ? "Pemilih yang sudah memilih tidak dapat direset tokennya"
                              : "Buat token baru untuk pemilih ini"
                          }
                          className="text-xs font-medium"
                        >
                          Reset token
                        </Button>
                        <Button
                          type="button"
                          variant="softDanger"
                          size="sm"
                          disabled={voter.hasVoted}
                          onClick={() => setDeleteTarget(voter)}
                          title={
                            voter.hasVoted
                              ? "Pemilih yang sudah memilih tidak dapat dihapus"
                              : "Hapus pemilih dari DPT"
                          }
                        >
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination Footer */}
        {meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-[#E2E8F0] bg-white px-5 py-3.5 sm:flex-row">
            <div className="text-xs text-[#64748B] tabular-nums">
              Menampilkan {startItem}-{endItem} dari {meta.total} • Halaman{" "}
              {meta.page} dari {totalPages}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page <= 1 || votersQuery.isFetching}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    page: Math.max(1, (prev.page ?? 1) - 1),
                  }))
                }
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sebelumnya</span>
              </Button>

              {pageNumbers.map((pageNum) => (
                <Button
                  key={pageNum}
                  type="button"
                  variant={pageNum === meta.page ? "default" : "ghost"}
                  size="sm"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, page: pageNum }))
                  }
                  className="h-8 w-8 p-0 tabular-nums"
                >
                  {pageNum}
                </Button>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page >= totalPages || votersQuery.isFetching}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    page: Math.min(totalPages, (prev.page ?? 1) + 1),
                  }))
                }
              >
                <span>Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Voter Modal */}
      <VoterFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        electionId={electionId}
        mode={formMode}
        voter={editingVoter}
        voterGroups={masterData.voterGroups}
        idLabel={idLabel}
        groupLabel={groupLabel}
      />

      {/* Bulk Import DPT Modal */}
      {importOpen && (
        <DptImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          electionId={electionId}
          idLabel={idLabel}
          groupLabel={groupLabel}
          gradeLabel={gradeLabel}
          majorLabel={majorLabel}
        />
      )}

      {/* Reset Token Confirmation */}
      <AlertDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open && !resetTokenMutation.isPending) {
            setResetTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset token pemilih?</AlertDialogTitle>
            <AlertDialogDescription>
              Token lama milik{" "}
              <span className="font-semibold text-[#0F172A]">
                {resetTarget?.name}
              </span>{" "}
              (<span className="font-mono">{resetTarget?.voterIdentity}</span>)
              akan hangus dan sesi login aktifnya akan diakhiri. Token 8
              karakter baru akan dibuat secara otomatis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetTokenMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmResetToken();
              }}
              disabled={resetTokenMutation.isPending}
            >
              {resetTokenMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>Ya, reset token</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Voter Confirmation */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteVoterMutation.isPending) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pemilih dari DPT?</AlertDialogTitle>
            <AlertDialogDescription>
              Data pemilih{" "}
              <span className="font-semibold text-[#0F172A]">
                {deleteTarget?.name}
              </span>{" "}
              (<span className="font-mono">{deleteTarget?.voterIdentity}</span>)
              akan dihapus permanen dari daftar pemilih tetap. Tindakan ini
              tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVoterMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleteVoterMutation.isPending}
              className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
            >
              {deleteVoterMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>Ya, hapus pemilih</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Bulk Delete Voter Confirmation */}
      <AlertDialog
        open={Boolean(bulkDeleteTarget)}
        onOpenChange={(open) => {
          if (!open && !bulkDeleteMutation.isPending) {
            setBulkDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-[16px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#0F172A]">
              {bulkDeleteTarget === "selected"
                ? `Hapus ${selectedVoterIds.size} Pemilih Terpilih?`
                : `Hapus Seluruh Pemilih Belum Memilih?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#64748B] leading-relaxed">
              {bulkDeleteTarget === "selected" ? (
                <>
                  Aksi ini akan menghapus permanen{" "}
                  <strong className="text-[#0F172A]">{selectedVoterIds.size} pemilih</strong>{" "}
                  yang dipilih dari DPT. Seluruh token aktif mereka akan hangus.
                  Data yang sudah dihapus tidak dapat dipulihkan.
                </>
              ) : (
                <>
                  Aksi ini akan menghapus seluruh pemilih yang berstatus{" "}
                  <strong className="text-[#0F172A]">Belum memilih ({summary.notVoted} pemilih)</strong>{" "}
                  dari DPT pemilihan ini. Pemilih yang sudah memberikan suara tetap
                  aman dan tidak akan terhapus.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={bulkDeleteMutation.isPending}
              className="rounded-[10px]"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmBulkDelete();
              }}
              disabled={bulkDeleteMutation.isPending}
              className="rounded-[10px] bg-[#DC2626] font-semibold text-white hover:bg-[#B91C1C]"
            >
              {bulkDeleteMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Menghapus...</span>
                </div>
              ) : (
                "Ya, hapus pemilih"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
