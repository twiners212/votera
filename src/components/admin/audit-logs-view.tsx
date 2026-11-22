"use client";

import * as React from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  AuditLogFilterBar,
  type ActionOption,
} from "@/components/admin/audit-log-filter-bar";
import { KpiStatCard } from "@/components/admin/kpi-stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuditLogs } from "@/hooks/use-audit-logs";
import { escapeSpreadsheetCell } from "@/lib/importers/csv-sanitizer";
import { cn, formatDateWIB } from "@/lib/utils";
import type { ActorType, AuditLogDTO, AuditLogFilterParams } from "@/types/votera";

const INITIAL_FILTERS: AuditLogFilterParams = {
  page: 1,
  limit: 25,
  search: "",
  actorType: "all",
  action: "all",
  dateFrom: "",
  dateTo: "",
};

const INTEGER_FORMATTER = new Intl.NumberFormat("id-ID");

function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return INTEGER_FORMATTER.format(value);
}

function formatLogTimestamp(isoString: string): { date: string; time: string } {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return { date: "-", time: "-" };
  }

  const datePart = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);

  const timeRaw = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);

  return {
    date: datePart,
    time: `${timeRaw.replaceAll(".", ":")} WIB`,
  };
}

const ACTOR_BADGE_META: Record<
  ActorType,
  { label: string; className: string }
> = {
  admin: {
    label: "Panitia",
    className: "bg-[#FEE2E2] text-[#DC2626]",
  },
  voter: {
    label: "Pemilih",
    className: "bg-[#DCFCE7] text-[#15803D]",
  },
  system: {
    label: "Sistem",
    className: "bg-[#F1F5F9] text-[#475569]",
  },
};

function getActionVisualMeta(log: AuditLogDTO): {
  titleClassName: string;
  dotClassName: string;
} {
  if (log.action === "vote_cast") {
    return {
      titleClassName: "text-[#15803D]",
      dotClassName: "bg-[#16A34A]",
    };
  }
  if (log.action === "voter_login_failed") {
    return {
      titleClassName: "text-[#DC2626]",
      dotClassName: "bg-[#DC2626]",
    };
  }
  if (log.actorType === "admin") {
    return {
      titleClassName: "text-[#0F172A]",
      dotClassName: "bg-[#D93829]",
    };
  }
  if (log.actorType === "voter") {
    return {
      titleClassName: "text-[#0F172A]",
      dotClassName: "bg-[#16A34A]",
    };
  }
  return {
    titleClassName: "text-[#0F172A]",
    dotClassName: "bg-[#94A3B8]",
  };
}

function getPaginationRange(currentPage: number, totalPages: number): number[] {
  const maxVisible = 5;
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export interface AuditLogsViewProps {
  electionId?: string;
}

export function AuditLogsView({ electionId = "active" }: AuditLogsViewProps) {
  const [filters, setFilters] =
    React.useState<AuditLogFilterParams>(INITIAL_FILTERS);

  const { data, isLoading, isFetching, isError, error, refetch } = useAuditLogs(
    electionId,
    filters
  );

  const logs = React.useMemo(() => data?.logs ?? [], [data?.logs]);
  const summary = data?.summary ?? {
    totalLogs: 0,
    adminActivities: 0,
    voterLoginSuccess: 0,
    voterLoginFailed: 0,
  };
  const meta = data?.meta ?? {
    page: filters.page ?? 1,
    limit: filters.limit ?? 25,
    total: 0,
    totalPages: 1,
  };

  const extraActions = React.useMemo<ActionOption[]>(() => {
    const map = new Map<string, string>();
    for (const item of logs) {
      if (item.action && !map.has(item.action)) {
        map.set(item.action, item.actionTitle || item.action);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [logs]);

  const hasActiveFilters = Boolean(
    (filters.search && filters.search.trim().length > 0) ||
      (filters.actorType && filters.actorType !== "all") ||
      (filters.action && filters.action !== "all") ||
      filters.dateFrom ||
      filters.dateTo
  );

  const handleApplyFilters = (nextFilters: AuditLogFilterParams) => {
    setFilters({
      ...nextFilters,
      page: 1,
      limit: INITIAL_FILTERS.limit,
    });
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > meta.totalPages || nextPage === meta.page) {
      return;
    }
    setFilters((prev) => ({ ...prev, page: nextPage }));
  };

  const [isExportingCsv, setIsExportingCsv] = React.useState(false);

  const handleExportCsv = async () => {
    if (isExportingCsv) return;
    setIsExportingCsv(true);
    try {
      const baseParams = new URLSearchParams();
      if (electionId && electionId !== "active") {
        baseParams.set("electionId", electionId);
      }
      baseParams.set("limit", "100");
      if (filters.search) baseParams.set("search", filters.search);
      if (filters.actorType && filters.actorType !== "all") {
        baseParams.set("actorType", filters.actorType);
      }
      if (filters.action && filters.action !== "all") {
        baseParams.set("action", filters.action);
      }
      if (filters.dateFrom) baseParams.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) baseParams.set("dateTo", filters.dateTo);

      const rows: AuditLogDTO[] = [];
      let currentPage = 1;
      let totalPages = 1;
      const maxPages = 10;

      do {
        const pageParams = new URLSearchParams(baseParams);
        pageParams.set("page", String(currentPage));

        const res = await fetch(`/api/admin/logs?${pageParams.toString()}`);
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success || !Array.isArray(json.data?.logs)) {
          throw new Error("Gagal mengambil data log untuk diekspor");
        }

        rows.push(...(json.data.logs as AuditLogDTO[]));
        totalPages = Math.min(
          maxPages,
          Math.max(1, Number(json.data.meta?.totalPages ?? 1))
        );
        currentPage += 1;
      } while (currentPage <= totalPages);
      const headers = [
        "Waktu (WIB)",
        "Aktor",
        "Tipe Aktor",
        "Identitas",
        "Aksi",
        "Deskripsi",
        "IP Address",
      ];

      const escapeCsvValue = (val: unknown): string => {
        const escaped = escapeSpreadsheetCell(val);
        const str = String(escaped ?? "").replace(/"/g, '""');
        return `"${str}"`;
      };

      const csvContent = [
        headers.map(escapeCsvValue).join(","),
        ...rows.map((row) =>
          [
            formatDateWIB(row.createdAt, { withSeconds: true }),
            row.actorName,
            row.actorType,
            row.actorIdentity,
            row.actionTitle || row.action,
            row.description,
            row.ipAddress,
          ]
            .map(escapeCsvValue)
            .join(",")
        ),
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `log-aktivitas-${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        `Berhasil mengekspor ${rows.length} catatan log aktivitas.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mengekspor log aktivitas"
      );
    } finally {
      setIsExportingCsv(false);
    }
  };

  const startRow = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const endRow = Math.min(meta.total, meta.page * meta.limit);
  const pageNumbers = getPaginationRange(meta.page, Math.max(1, meta.totalPages));

  return (
    <div className="space-y-6">
      {/* Immutability Notice & Refresh Header */}
      <div className="flex flex-col gap-3 rounded-[16px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#475569]">
                <Lock className="h-3 w-3" aria-hidden="true" />
                <span>Read-Only</span>
              </span>
              <span className="text-xs font-semibold text-[#0F172A]">
                Catatan Audit Permanen
              </span>
            </div>
            <p className="mt-1 text-sm text-[#475569]">
              Data ini hanya untuk dibaca dan tidak bisa diubah dari panel.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-[44px] sm:h-9 sm:min-h-0 shrink-0 gap-1.5"
            onClick={handleExportCsv}
            disabled={isExportingCsv || isLoading}
          >
            <Download
              className={cn("h-4 w-4", isExportingCsv && "animate-spin")}
              aria-hidden="true"
            />
            <span>Ekspor Log (CSV)</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-[44px] sm:h-9 sm:min-h-0 shrink-0 gap-1.5"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            <span>Segarkan</span>
          </Button>
        </div>
      </div>

      {/* 4 Compact KPI Cards */}
      <section
        aria-label="Ringkasan log aktivitas"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[92px] animate-pulse rounded-[16px] border border-[#E2E8F0] bg-white px-5 py-4"
            >
              <div className="h-7 w-16 rounded bg-[#F1F5F9]" />
              <div className="mt-2.5 h-3.5 w-28 rounded bg-[#F1F5F9]" />
            </div>
          ))
        ) : (
          <>
            <KpiStatCard
              variant="compact"
              label="Total catatan"
              value={formatInteger(summary.totalLogs)}
            />
            <KpiStatCard
              variant="compact"
              label="Aktivitas panitia"
              value={formatInteger(summary.adminActivities)}
            />
            <KpiStatCard
              variant="compact"
              label="Login pemilih berhasil"
              value={formatInteger(summary.voterLoginSuccess)}
              valueClassName="text-[#15803D]"
            />
            <KpiStatCard
              variant="compact"
              label="Login gagal"
              value={formatInteger(summary.voterLoginFailed)}
              valueClassName={
                summary.voterLoginFailed > 0 ? "text-[#DC2626]" : undefined
              }
            />
          </>
        )}
      </section>

      {/* 5-Column Filter Bar */}
      <AuditLogFilterBar
        filters={filters}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        extraActions={extraActions}
        isFetching={isFetching}
      />

      {/* Read-Only Table Card */}
      <section
        aria-label="Daftar catatan aktivitas"
        className="overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div className="flex flex-col gap-2 border-b border-[#F1F5F9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              Catatan aktivitas
            </h2>
            <p className="text-xs text-[#64748B]">
              Jejak aktivitas panitia, pemilih, dan sistem hingga satuan detik
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#475569] tabular-nums">
              {meta.total > 0
                ? `Menampilkan ${formatInteger(startRow)}–${formatInteger(
                    endRow
                  )} dari ${formatInteger(meta.total)}`
                : "Menampilkan 0 catatan"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#64748B]">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>Read-Only</span>
            </span>
          </div>
        </div>

        {isError ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">
              Gagal memuat log aktivitas
            </h3>
            <p className="mt-1 max-w-md text-xs text-[#64748B]">
              {error?.message ||
                "Terjadi gangguan saat mengambil data log dari server."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="mt-4"
            >
              Coba lagi
            </Button>
          </div>
        ) : isLoading ? (
          <div className="divide-y divide-[#F1F5F9]">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-5 gap-4 px-5 py-4 animate-pulse"
              >
                <div className="space-y-1.5">
                  <div className="h-3.5 w-20 rounded bg-[#F1F5F9]" />
                  <div className="h-3 w-24 rounded bg-[#F1F5F9]" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-[#F1F5F9]" />
                  <div className="h-3 w-20 rounded bg-[#F1F5F9]" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-28 rounded bg-[#F1F5F9]" />
                  <div className="h-3 w-24 rounded bg-[#F1F5F9]" />
                </div>
                <div className="h-4 w-48 rounded bg-[#F1F5F9]" />
                <div className="ml-auto h-6 w-12 rounded bg-[#F1F5F9]" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="Catatan aktivitas tidak ditemukan"
            description={
              hasActiveFilters
                ? "Tidak ada log yang cocok dengan kriteria pencarian atau rentang tanggal yang dipilih."
                : "Belum ada catatan aktivitas yang terekam pada pemilihan ini."
            }
            onReset={hasActiveFilters ? handleResetFilters : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[160px] px-5 py-3">WAKTU</TableHead>
                <TableHead className="w-[220px] py-3 px-4">PELAKU</TableHead>
                <TableHead className="w-[200px] py-3 px-4">AKSI</TableHead>
                <TableHead className="min-w-[300px] py-3 px-4">KETERANGAN</TableHead>
                <TableHead className="w-[140px] px-5 py-3 text-right">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const timestamp = formatLogTimestamp(log.createdAt);
                const actorBadge =
                  ACTOR_BADGE_META[log.actorType] ?? ACTOR_BADGE_META.system;
                const actionVisual = getActionVisualMeta(log);

                return (
                  <TableRow key={log.id} className="h-14 hover:bg-[#FAF9F7]">
                    <TableCell className="whitespace-nowrap px-5 py-3 align-top">
                      <div className="flex flex-col text-xs font-semibold tabular-nums">
                        <span className="text-[#0F172A]">
                          {timestamp.date}
                        </span>
                        <span className="mt-0.5 text-[#64748B]">
                          {timestamp.time}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 px-4 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#0F172A]">
                            {log.actorName}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
                              actorBadge.className
                            )}
                          >
                            {actorBadge.label}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-semibold text-[#64748B] tabular-nums">
                          {log.actorIdentity}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 px-4 align-top">
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            actionVisual.titleClassName
                          )}
                        >
                          {log.actionTitle}
                        </span>
                        <span className="mt-0.5 font-mono text-xs text-[#64748B]">
                          {log.action}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 px-4 align-top">
                      <div className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            actionVisual.dotClassName
                          )}
                        />
                        <span className="text-sm leading-relaxed text-[#334155]">
                          {log.description}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap px-5 py-3 text-right align-top">
                      <span className="inline-flex items-center rounded-[6px] border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-[#475569]">
                        {log.ipAddress || "::1"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination Footer */}
        {meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-[#F1F5F9] bg-white px-5 py-3.5 sm:flex-row">
            <div className="text-xs text-[#64748B] tabular-nums">
              Halaman{" "}
              <span className="font-semibold text-[#0F172A]">{meta.page}</span>{" "}
              dari{" "}
              <span className="font-semibold text-[#0F172A]">
                {Math.max(1, meta.totalPages)}
              </span>{" "}
              ({formatInteger(meta.total)} catatan)
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(meta.page - 1)}
                disabled={meta.page <= 1 || isFetching}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sebelumnya</span>
              </Button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((pageNum) => {
                  const isActive = pageNum === meta.page;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      disabled={isFetching}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "h-8 min-w-[32px] rounded-[8px] px-2 text-xs font-semibold tabular-nums transition-colors",
                        isActive
                          ? "bg-[#D93829] text-white shadow-sm"
                          : "text-[#475569] hover:bg-[#F1F5F9]"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(meta.page + 1)}
                disabled={meta.page >= meta.totalPages || isFetching}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <span>Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
