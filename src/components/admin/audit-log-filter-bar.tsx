"use client";

import * as React from "react";
import { Filter, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActorType, AuditLogFilterParams } from "@/types/votera";

export interface ActionOption {
  value: string;
  label: string;
}

const DEFAULT_ACTION_OPTIONS: ActionOption[] = [
  { value: "all", label: "Semua aksi" },
  { value: "admin_login", label: "Admin login" },
  { value: "voter_login", label: "Pemilih login" },
  { value: "voter_login_failed", label: "Login gagal" },
  { value: "vote_cast", label: "Vote cast" },
  { value: "voter_logout", label: "Pemilih logout" },
  { value: "voter_token_reset", label: "Reset token" },
  { value: "voter_token_copied", label: "Token disalin" },
  { value: "voters_bulk_imported", label: "Impor DPT massal" },
  { value: "dpt_imported", label: "Impor DPT awal" },
  { value: "election_created", label: "Pemilihan dibuat" },
  { value: "candidates_registered", label: "Kandidat didaftarkan" },
  { value: "election_settings_updated", label: "Pengaturan diperbarui" },
];

export interface AuditLogFilterBarProps {
  filters: AuditLogFilterParams;
  onApplyFilters: (nextFilters: AuditLogFilterParams) => void;
  onResetFilters: () => void;
  extraActions?: ActionOption[];
  isFetching?: boolean;
}

export function AuditLogFilterBar({
  filters,
  onApplyFilters,
  onResetFilters,
  extraActions = [],
  isFetching = false,
}: AuditLogFilterBarProps) {
  const [search, setSearch] = React.useState(filters.search ?? "");
  const [actorType, setActorType] = React.useState<"all" | ActorType>(
    filters.actorType ?? "all"
  );
  const [action, setAction] = React.useState(filters.action ?? "all");
  const [dateFrom, setDateFrom] = React.useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = React.useState(filters.dateTo ?? "");

  React.useEffect(() => {
    setSearch(filters.search ?? "");
    setActorType(filters.actorType ?? "all");
    setAction(filters.action ?? "all");
    setDateFrom(filters.dateFrom ?? "");
    setDateTo(filters.dateTo ?? "");
  }, [
    filters.search,
    filters.actorType,
    filters.action,
    filters.dateFrom,
    filters.dateTo,
  ]);

  const actionOptions = React.useMemo(() => {
    const seen = new Set(DEFAULT_ACTION_OPTIONS.map((item) => item.value));
    const merged = [...DEFAULT_ACTION_OPTIONS];
    for (const item of extraActions) {
      if (item.value && !seen.has(item.value)) {
        seen.add(item.value);
        merged.push(item);
      }
    }
    return merged;
  }, [extraActions]);

  const hasActiveFilter = Boolean(
    (filters.search && filters.search.trim().length > 0) ||
      (filters.actorType && filters.actorType !== "all") ||
      (filters.action && filters.action !== "all") ||
      filters.dateFrom ||
      filters.dateTo
  );

  const buildNextFilters = (
    overrides: Partial<AuditLogFilterParams> = {}
  ): AuditLogFilterParams => ({
    ...filters,
    page: 1,
    search: search.trim(),
    actorType,
    action,
    dateFrom,
    dateTo,
    ...overrides,
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApplyFilters(buildNextFilters());
  };

  const handleActorChange = (value: string) => {
    const nextActor = value as "all" | ActorType;
    setActorType(nextActor);
    onApplyFilters(buildNextFilters({ actorType: nextActor }));
  };

  const handleActionChange = (value: string) => {
    setAction(value);
    onApplyFilters(buildNextFilters({ action: value }));
  };

  const handleDateFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDateFrom = event.target.value;
    setDateFrom(nextDateFrom);
    onApplyFilters(buildNextFilters({ dateFrom: nextDateFrom }));
  };

  const handleDateToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDateTo = event.target.value;
    setDateTo(nextDateTo);
    onApplyFilters(buildNextFilters({ dateTo: nextDateTo }));
  };

  const handleClearSearch = () => {
    setSearch("");
    onApplyFilters(buildNextFilters({ search: "" }));
  };

  return (
    <section
      aria-label="Filter log aktivitas"
      className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
          <h2 className="text-sm font-bold text-[#0F172A]">Filter Catatan</h2>
        </div>

        {hasActiveFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-[#64748B] hover:text-[#D93829]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset filter</span>
          </Button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(210px,1.5fr)_minmax(130px,1fr)_minmax(160px,1.1fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto] lg:items-end"
      >
        <div>
          <label
            htmlFor="audit-log-search"
            className="mb-1.5 block text-xs font-semibold text-[#475569]"
          >
            Cari
          </label>
          <Input
            id="audit-log-search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Keterangan, nama, NIS, atau IP"
            leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            rightElement={
              search ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Hapus kata kunci pencarian"
                  className="rounded p-0.5 text-[#94A3B8] hover:text-[#0F172A]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null
            }
          />
        </div>

        <div>
          <label
            htmlFor="audit-log-actor-type"
            className="mb-1.5 block text-xs font-semibold text-[#475569]"
          >
            Pelaku
          </label>
          <Select value={actorType} onValueChange={handleActorChange}>
            <SelectTrigger id="audit-log-actor-type" aria-label="Filter pelaku">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="admin">Panitia</SelectItem>
              <SelectItem value="voter">Pemilih</SelectItem>
              <SelectItem value="system">Sistem</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label
            htmlFor="audit-log-action"
            className="mb-1.5 block text-xs font-semibold text-[#475569]"
          >
            Aksi
          </label>
          <Select value={action} onValueChange={handleActionChange}>
            <SelectTrigger id="audit-log-action" aria-label="Filter aksi">
              <SelectValue placeholder="Semua aksi" />
            </SelectTrigger>
            <SelectContent>
              {actionOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label
            htmlFor="audit-log-date-from"
            className="mb-1.5 block text-xs font-semibold text-[#475569]"
          >
            Dari tanggal
          </label>
          <Input
            id="audit-log-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={handleDateFromChange}
            className="tabular-nums"
          />
        </div>

        <div>
          <label
            htmlFor="audit-log-date-to"
            className="mb-1.5 block text-xs font-semibold text-[#475569]"
          >
            Sampai tanggal
          </label>
          <Input
            id="audit-log-date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={handleDateToChange}
            className="tabular-nums"
          />
        </div>

        <Button
          type="submit"
          disabled={isFetching}
          className="w-full lg:w-auto lg:px-5"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>Cari</span>
        </Button>
      </form>
    </section>
  );
}
