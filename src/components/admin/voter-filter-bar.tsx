"use client";

import * as React from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  GradeLevelDTO,
  MajorDTO,
  VoterFilterParams,
  VoterGroupDTO,
  VoterStatus,
} from "@/types/votera";

export interface VoterFilterBarProps {
  filters: VoterFilterParams;
  onFiltersChange: (next: VoterFilterParams) => void;
  onReset: () => void;
  gradeLevels: GradeLevelDTO[];
  majors: MajorDTO[];
  voterGroups: VoterGroupDTO[];
  idLabel?: string;
  groupLabel?: string;
  gradeLabel?: string;
  majorLabel?: string;
}

export function VoterFilterBar({
  filters,
  onFiltersChange,
  onReset,
  gradeLevels,
  majors,
  voterGroups,
  idLabel = "NIS",
  groupLabel = "Rombel",
  gradeLabel = "Tingkat",
  majorLabel = "Jurusan",
}: VoterFilterBarProps) {
  const [searchInput, setSearchInput] = React.useState(filters.search ?? "");

  React.useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  const hasActiveFilters = Boolean(
    (filters.search && filters.search.trim() !== "") ||
      (filters.status && filters.status !== "all") ||
      (filters.groupId && filters.groupId !== "all") ||
      (filters.gradeLevelId && filters.gradeLevelId !== "all") ||
      (filters.majorId && filters.majorId !== "all")
  );

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onFiltersChange({
      ...filters,
      page: 1,
      search: searchInput.trim(),
    });
  }

  return (
    <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <form
        onSubmit={handleSearchSubmit}
        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-12"
      >
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <label
            htmlFor="voter-search-input"
            className="block text-xs font-semibold text-[#475569]"
          >
            Cari pemilih
          </label>
          <Input
            id="voter-search-input"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Nama atau ${idLabel}`}
            leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
          />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label
            htmlFor="voter-status-select"
            className="block text-xs font-semibold text-[#475569]"
          >
            Status
          </label>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                page: 1,
                status: value as "all" | VoterStatus,
              })
            }
          >
            <SelectTrigger id="voter-status-select">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="voted">Sudah memilih</SelectItem>
              <SelectItem value="logged_in">Sudah login</SelectItem>
              <SelectItem value="not_voted">Belum memilih</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label
            htmlFor="voter-group-select"
            className="block text-xs font-semibold text-[#475569]"
          >
            {groupLabel}
          </label>
          <Select
            value={filters.groupId ?? "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                page: 1,
                groupId: value,
              })
            }
          >
            <SelectTrigger id="voter-group-select">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {voterGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label
            htmlFor="voter-grade-select"
            className="block text-xs font-semibold text-[#475569]"
          >
            {gradeLabel}
          </label>
          <Select
            value={filters.gradeLevelId ?? "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                page: 1,
                gradeLevelId: value,
              })
            }
          >
            <SelectTrigger id="voter-grade-select">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {gradeLevels.map((grade) => (
                <SelectItem key={grade.id} value={grade.id}>
                  {grade.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label
            htmlFor="voter-major-select"
            className="block text-xs font-semibold text-[#475569]"
          >
            {majorLabel}
          </label>
          <Select
            value={filters.majorId ?? "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                page: 1,
                majorId: value,
              })
            }
          >
            <SelectTrigger id="voter-major-select">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {majors.map((major) => (
                <SelectItem key={major.id} value={major.id}>
                  {major.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" className="w-full">
            Cari
          </Button>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onReset}
              aria-label="Reset filter"
              title="Reset filter"
              className="shrink-0"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
