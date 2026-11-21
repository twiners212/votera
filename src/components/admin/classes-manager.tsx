"use client";

import * as React from "react";
import {
  AlertCircle,
  FolderTree,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateMasterItem,
  useDeleteMasterItem,
  useMasterData,
  useUpdateMasterItem,
} from "@/hooks/use-master-data";
import { cn } from "@/lib/utils";
import type {
  AdminRole,
  GradeLevelDTO,
  VoterGroupDTO,
} from "@/types/votera";

export interface ClassesManagerProps {
  electionId?: string;
  role?: AdminRole;
}

export function ClassesManager({
  electionId = "active",
  role = "committee",
}: ClassesManagerProps) {
  const isSuperAdmin = role === "super_admin";

  const { data, isLoading, isError, error, refetch, isFetching } =
    useMasterData(electionId);

  const createMutation = useCreateMasterItem(electionId);
  const updateMutation = useUpdateMasterItem(electionId);
  const deleteMutation = useDeleteMasterItem(electionId);

  const [activeTab, setActiveTab] = React.useState<"grades" | "groups">(
    "groups"
  );
  const [search, setSearch] = React.useState("");

  // Grade dialog state
  const [isGradeDialogOpen, setIsGradeDialogOpen] = React.useState(false);
  const [editingGrade, setEditingGrade] = React.useState<GradeLevelDTO | null>(
    null
  );
  const [gradeName, setGradeName] = React.useState("");
  const [gradeSortOrder, setGradeSortOrder] = React.useState(0);

  // Group dialog state
  const [isGroupDialogOpen, setIsGroupDialogOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<VoterGroupDTO | null>(
    null
  );
  const [groupName, setGroupName] = React.useState("");
  const [groupGradeId, setGroupGradeId] = React.useState<string>("none");
  const [groupMajorId, setGroupMajorId] = React.useState<string>("none");
  const [groupSortOrder, setGroupSortOrder] = React.useState(0);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = React.useState<{
    entity: "grade" | "group";
    id: string;
    name: string;
  } | null>(null);

  const gradeLevels = React.useMemo(
    () => data?.gradeLevels ?? [],
    [data?.gradeLevels]
  );
  const voterGroups = React.useMemo(
    () => data?.voterGroups ?? [],
    [data?.voterGroups]
  );
  const majors = React.useMemo(() => data?.majors ?? [], [data?.majors]);

  // Totals
  const totalGrades = gradeLevels.length;
  const totalGroups = voterGroups.length;
  const totalVotersInGroups = voterGroups.reduce(
    (acc, g) => acc + (g.voterCount ?? 0),
    0
  );

  // Filtered lists
  const filteredGrades = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gradeLevels;
    return gradeLevels.filter((g) => g.name.toLowerCase().includes(q));
  }, [gradeLevels, search]);

  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return voterGroups;
    return voterGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.gradeName && g.gradeName.toLowerCase().includes(q)) ||
        (g.majorName && g.majorName.toLowerCase().includes(q))
    );
  }, [voterGroups, search]);

  // Handlers for Grade
  const handleOpenCreateGrade = () => {
    setEditingGrade(null);
    setGradeName("");
    setGradeSortOrder(gradeLevels.length + 1);
    setIsGradeDialogOpen(true);
  };

  const handleOpenEditGrade = (grade: GradeLevelDTO) => {
    setEditingGrade(grade);
    setGradeName(grade.name);
    setGradeSortOrder(grade.sortOrder);
    setIsGradeDialogOpen(true);
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeName.trim()) {
      toast.error("Nama tingkat kelas tidak boleh kosong");
      return;
    }

    try {
      if (editingGrade) {
        await updateMutation.mutateAsync({
          entity: "grade",
          id: editingGrade.id,
          name: gradeName.trim(),
          sortOrder: gradeSortOrder,
        });
        toast.success("Tingkat kelas berhasil diperbarui");
      } else {
        await createMutation.mutateAsync({
          entity: "grade",
          name: gradeName.trim(),
          sortOrder: gradeSortOrder,
        });
        toast.success("Tingkat kelas berhasil ditambahkan");
      }
      setIsGradeDialogOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan tingkat kelas"
      );
    }
  };

  // Handlers for Group
  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupGradeId("none");
    setGroupMajorId("none");
    setGroupSortOrder(voterGroups.length + 1);
    setIsGroupDialogOpen(true);
  };

  const handleOpenEditGroup = (group: VoterGroupDTO) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupGradeId(group.gradeLevelId ?? "none");
    setGroupMajorId(group.majorId ?? "none");
    setGroupSortOrder(group.sortOrder);
    setIsGroupDialogOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Nama rombel tidak boleh kosong");
      return;
    }

    try {
      if (editingGroup) {
        await updateMutation.mutateAsync({
          entity: "group",
          id: editingGroup.id,
          name: groupName.trim(),
          gradeLevelId: groupGradeId === "none" ? null : groupGradeId,
          majorId: groupMajorId === "none" ? null : groupMajorId,
          sortOrder: groupSortOrder,
        });
        toast.success("Rombel berhasil diperbarui");
      } else {
        await createMutation.mutateAsync({
          entity: "group",
          name: groupName.trim(),
          gradeLevelId: groupGradeId === "none" ? null : groupGradeId,
          majorId: groupMajorId === "none" ? null : groupMajorId,
          sortOrder: groupSortOrder,
        });
        toast.success("Rombel berhasil ditambahkan");
      }
      setIsGroupDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan rombel");
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync({
        entity: deleteTarget.entity,
        id: deleteTarget.id,
      });
      toast.success(
        `${deleteTarget.entity === "grade" ? "Tingkat kelas" : "Rombel"} berhasil dihapus`
      );
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus entitas"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">
            Tingkat Kelas & Rombel
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Kelola struktur tingkat kelas dan rombel / kelompok pemilih untuk
            alokasi DPT.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="h-10 rounded-[10px] border-[#CBD5E1] bg-white text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            <span>Segarkan</span>
          </Button>

          {isSuperAdmin && (
            <Button
              type="button"
              onClick={
                activeTab === "grades"
                  ? handleOpenCreateGrade
                  : handleOpenCreateGroup
              }
              className="h-10 rounded-[10px] bg-[#D93829] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#B8281B]"
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              <span>
                {activeTab === "grades" ? "Tambah Tingkat" : "Tambah Rombel"}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Total Tingkat
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
              <Layers className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0F172A]">
            {totalGrades}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Total Rombel / Kelas
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#475569]">
              <FolderTree className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0F172A]">
            {totalGroups}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Pemilih Teralokasi
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0F172A]">
            {totalVotersInGroups}
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Search */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("groups")}
            className={cn(
              "rounded-[10px] px-4 py-2 text-xs font-bold transition-colors",
              activeTab === "groups"
                ? "bg-[#D93829] text-white shadow-sm"
                : "bg-white text-[#475569] hover:bg-[#F8FAFC]"
            )}
          >
            Rombel / Kelompok ({totalGroups})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("grades")}
            className={cn(
              "rounded-[10px] px-4 py-2 text-xs font-bold transition-colors",
              activeTab === "grades"
                ? "bg-[#D93829] text-white shadow-sm"
                : "bg-white text-[#475569] hover:bg-[#F8FAFC]"
            )}
          >
            Tingkat Kelas ({totalGrades})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === "grades"
                ? "Cari nama tingkat..."
                : "Cari rombel, tingkat, jurusan..."
            }
            className="h-10 rounded-[10px] border-[#CBD5E1] bg-white pl-9 text-xs focus-visible:ring-[#D93829]/20"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#D93829]" />
          <p className="mt-3 text-sm text-[#64748B]">Memuat data master...</p>
        </div>
      ) : isError ? (
        <div className="rounded-[12px] border border-[#FECACA] bg-[#FFF5F5] p-6 text-center text-[#DC2626]">
          <AlertCircle className="mx-auto h-8 w-8" />
          <p className="mt-2 text-sm font-semibold">Gagal memuat data master</p>
          <p className="text-xs text-[#64748B]">{error?.message}</p>
        </div>
      ) : activeTab === "grades" ? (
        <section
          aria-label="Tabel tingkat kelas"
          className="overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          {filteredGrades.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Layers className="h-5 w-5" />}
                title="Belum ada tingkat kelas"
                description={
                  search
                    ? `Tidak ditemukan hasil pencarian untuk "${search}".`
                    : "Tambahkan tingkat kelas untuk mengelompokkan rombel."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#F1F5F9] bg-[#F8FAFC]/60 hover:bg-transparent">
                  <TableHead className="w-16 px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Urutan
                  </TableHead>
                  <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Nama Tingkat
                  </TableHead>
                  <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Jumlah Rombel
                  </TableHead>
                  {isSuperAdmin && (
                    <TableHead className="w-36 px-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Aksi
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrades.map((grade) => (
                  <TableRow
                    key={grade.id}
                    className="border-b border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC]"
                  >
                    <TableCell className="px-4 py-3.5 font-mono text-xs tabular-nums text-[#64748B]">
                      {grade.sortOrder}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-sm font-semibold text-[#0F172A]">
                      {grade.name}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-xs tabular-nums text-[#475569]">
                      {grade.groupCount ?? 0} rombel
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditGrade(grade)}
                            className="h-8 rounded-[8px] border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({
                                entity: "grade",
                                id: grade.id,
                                name: grade.name,
                              })
                            }
                            className="h-8 rounded-[8px] bg-[#FEE2E2] px-2.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FECACA]"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            <span>Hapus</span>
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ) : (
        <section
          aria-label="Tabel rombel pemilih"
          className="overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          {filteredGroups.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<FolderTree className="h-5 w-5" />}
                title="Belum ada rombel"
                description={
                  search
                    ? `Tidak ditemukan hasil pencarian untuk "${search}".`
                    : "Tambahkan rombel atau impor DPT untuk membuat rombel secara otomatis."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-[#F1F5F9] bg-[#F8FAFC]/60 hover:bg-transparent">
                  <TableHead className="w-16 px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Urutan
                  </TableHead>
                  <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Nama Rombel / Kelas
                  </TableHead>
                  <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Tingkat
                  </TableHead>
                  <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Jurusan
                  </TableHead>
                  <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Jumlah Pemilih
                  </TableHead>
                  {isSuperAdmin && (
                    <TableHead className="w-36 px-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                      Aksi
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => (
                  <TableRow
                    key={group.id}
                    className="border-b border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC]"
                  >
                    <TableCell className="px-4 py-3.5 font-mono text-xs tabular-nums text-[#64748B]">
                      {group.sortOrder}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-sm font-semibold text-[#0F172A]">
                      {group.name}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-xs text-[#475569]">
                      {group.gradeName ? (
                        <span className="inline-flex rounded-md bg-[#F1F5F9] px-2 py-0.5 font-medium text-[#334155]">
                          {group.gradeName}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 text-xs text-[#475569]">
                      {group.majorName ? (
                        <span className="inline-flex rounded-md bg-[#F1F5F9] px-2 py-0.5 font-medium text-[#334155]">
                          {group.majorName}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3.5 font-semibold tabular-nums text-[#0F172A]">
                      {group.voterCount ?? 0}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditGroup(group)}
                            className="h-8 rounded-[8px] border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({
                                entity: "group",
                                id: group.id,
                                name: group.name,
                              })
                            }
                            className="h-8 rounded-[8px] bg-[#FEE2E2] px-2.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FECACA]"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            <span>Hapus</span>
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}

      {/* Modal Add/Edit Grade */}
      <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <form onSubmit={handleSaveGrade}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                {editingGrade ? "Edit Tingkat Kelas" : "Tambah Tingkat Kelas"}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Masukkan nama tingkat kelas (misalnya Kelas 10, Kelas 11, Kelas
                12).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label htmlFor="gradeName" className="text-xs font-semibold text-[#334155]">
                  Nama Tingkat <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="gradeName"
                  value={gradeName}
                  onChange={(e) => setGradeName(e.target.value)}
                  placeholder="Contoh: Kelas 10"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="gradeSortOrder" className="text-xs font-semibold text-[#334155]">
                  Nomor Urutan Tampilan
                </label>
                <Input
                  id="gradeSortOrder"
                  type="number"
                  value={gradeSortOrder}
                  onChange={(e) => setGradeSortOrder(Number(e.target.value))}
                  className="h-10 rounded-[10px] border-[#CBD5E1] tabular-nums"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsGradeDialogOpen(false)}
                className="h-10 rounded-[10px] border-[#CBD5E1] text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-10 rounded-[10px] bg-[#D93829] px-4 text-xs font-semibold text-white hover:bg-[#B8281B]"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                <span>Simpan</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Add/Edit Group */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <form onSubmit={handleSaveGroup}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                {editingGroup ? "Edit Rombel" : "Tambah Rombel"}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Tentukan nama rombel / kelas pemilih serta kaitkan dengan
                tingkat dan jurusan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label htmlFor="groupName" className="text-xs font-semibold text-[#334155]">
                  Nama Rombel / Kelas <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Contoh: X PPLG 1"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="groupGrade" className="text-xs font-semibold text-[#334155]">
                  Tingkat Kelas
                </label>
                <Select
                  value={groupGradeId}
                  onValueChange={(val) => setGroupGradeId(val)}
                >
                  <SelectTrigger
                    id="groupGrade"
                    className="h-10 rounded-[10px] border-[#CBD5E1]"
                  >
                    <SelectValue placeholder="Pilih tingkat..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tanpa Tingkat --</SelectItem>
                    {gradeLevels.map((gl) => (
                      <SelectItem key={gl.id} value={gl.id}>
                        {gl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="groupMajor" className="text-xs font-semibold text-[#334155]">
                  Jurusan / Program
                </label>
                <Select
                  value={groupMajorId}
                  onValueChange={(val) => setGroupMajorId(val)}
                >
                  <SelectTrigger
                    id="groupMajor"
                    className="h-10 rounded-[10px] border-[#CBD5E1]"
                  >
                    <SelectValue placeholder="Pilih jurusan..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tanpa Jurusan --</SelectItem>
                    {majors.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} {m.code ? `(${m.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="groupSortOrder" className="text-xs font-semibold text-[#334155]">
                  Nomor Urutan Tampilan
                </label>
                <Input
                  id="groupSortOrder"
                  type="number"
                  value={groupSortOrder}
                  onChange={(e) => setGroupSortOrder(Number(e.target.value))}
                  className="h-10 rounded-[10px] border-[#CBD5E1] tabular-nums"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsGroupDialogOpen(false)}
                className="h-10 rounded-[10px] border-[#CBD5E1] text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-10 rounded-[10px] bg-[#D93829] px-4 text-xs font-semibold text-white hover:bg-[#B8281B]"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                <span>Simpan</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#DC2626]">
              Hapus{" "}
              {deleteTarget?.entity === "grade" ? "Tingkat Kelas" : "Rombel"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Apakah Anda yakin ingin menghapus{" "}
              <strong className="text-[#0F172A]">{deleteTarget?.name}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="h-10 rounded-[10px] border-[#CBD5E1] text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="h-10 rounded-[10px] bg-[#DC2626] px-4 text-xs font-semibold text-white hover:bg-[#B91C1C]"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              <span>Hapus Sekarang</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
