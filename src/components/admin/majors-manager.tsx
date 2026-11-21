"use client";

import * as React from "react";
import {
  AlertCircle,
  FolderTree,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
import type { AdminRole, MajorDTO } from "@/types/votera";

export interface MajorsManagerProps {
  electionId?: string;
  role?: AdminRole;
}

export function MajorsManager({
  electionId = "active",
  role = "committee",
}: MajorsManagerProps) {
  const isSuperAdmin = role === "super_admin";

  const { data, isLoading, isError, error, refetch, isFetching } =
    useMasterData(electionId);

  const createMutation = useCreateMasterItem(electionId);
  const updateMutation = useUpdateMasterItem(electionId);
  const deleteMutation = useDeleteMasterItem(electionId);

  const [search, setSearch] = React.useState("");

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingMajor, setEditingMajor] = React.useState<MajorDTO | null>(null);
  const [majorName, setMajorName] = React.useState("");
  const [majorCode, setMajorCode] = React.useState("");
  const [majorSortOrder, setMajorSortOrder] = React.useState(0);

  // Delete state
  const [deleteTarget, setDeleteTarget] = React.useState<MajorDTO | null>(null);

  const majors = React.useMemo(() => data?.majors ?? [], [data?.majors]);

  // Total rombel using majors
  const totalAssociatedGroups = React.useMemo(() => {
    return majors.reduce((acc, m) => acc + (m.groupCount ?? 0), 0);
  }, [majors]);

  // Filtered
  const filteredMajors = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return majors;
    return majors.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.code && m.code.toLowerCase().includes(q))
    );
  }, [majors, search]);

  const handleOpenCreate = () => {
    setEditingMajor(null);
    setMajorName("");
    setMajorCode("");
    setMajorSortOrder(majors.length + 1);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (major: MajorDTO) => {
    setEditingMajor(major);
    setMajorName(major.name);
    setMajorCode(major.code ?? "");
    setMajorSortOrder(major.sortOrder);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!majorName.trim()) {
      toast.error("Nama jurusan tidak boleh kosong");
      return;
    }

    try {
      if (editingMajor) {
        await updateMutation.mutateAsync({
          entity: "major",
          id: editingMajor.id,
          name: majorName.trim(),
          code: majorCode.trim() || null,
          sortOrder: majorSortOrder,
        });
        toast.success("Jurusan berhasil diperbarui");
      } else {
        await createMutation.mutateAsync({
          entity: "major",
          name: majorName.trim(),
          code: majorCode.trim() || null,
          sortOrder: majorSortOrder,
        });
        toast.success("Jurusan berhasil ditambahkan");
      }
      setIsDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan jurusan");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync({
        entity: "major",
        id: deleteTarget.id,
      });
      toast.success("Jurusan berhasil dihapus");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus jurusan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">
            Jurusan / Program Keahlian
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Kelola daftar jurusan dan program keahlian untuk segmentasi partisipasi
            pemilih.
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
              onClick={handleOpenCreate}
              className="h-10 rounded-[10px] bg-[#D93829] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#B8281B]"
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              <span>Tambah Jurusan</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Total Jurusan Terdaftar
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0F172A]">
            {majors.length}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Total Rombel Terhubung
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#475569]">
              <FolderTree className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0F172A]">
            {totalAssociatedGroups}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau kode jurusan..."
            className="h-10 rounded-[10px] border-[#CBD5E1] bg-white pl-9 text-xs focus-visible:ring-[#D93829]/20"
          />
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#D93829]" />
          <p className="mt-3 text-sm text-[#64748B]">Memuat data jurusan...</p>
        </div>
      ) : isError ? (
        <div className="rounded-[12px] border border-[#FECACA] bg-[#FFF5F5] p-6 text-center text-[#DC2626]">
          <AlertCircle className="mx-auto h-8 w-8" />
          <p className="mt-2 text-sm font-semibold">Gagal memuat data jurusan</p>
          <p className="text-xs text-[#64748B]">{error?.message}</p>
        </div>
      ) : filteredMajors.length === 0 ? (
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-8">
          <EmptyState
            icon={<GraduationCap className="h-5 w-5" />}
            title="Belum ada jurusan"
            description={
              search
                ? `Tidak ditemukan hasil pencarian untuk "${search}".`
                : "Tambahkan jurusan baru untuk mengelompokkan siswa berdasarkan program keahlian."
            }
          />
        </div>
      ) : (
        <section
          aria-label="Tabel jurusan"
          className="overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#F1F5F9] bg-[#F8FAFC]/60 hover:bg-transparent">
                <TableHead className="w-16 px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Urutan
                </TableHead>
                <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Nama Jurusan
                </TableHead>
                <TableHead className="w-32 px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Kode
                </TableHead>
                <TableHead className="w-40 px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Rombel Terhubung
                </TableHead>
                {isSuperAdmin && (
                  <TableHead className="w-36 px-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Aksi
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMajors.map((major) => (
                <TableRow
                  key={major.id}
                  className="border-b border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC]"
                >
                  <TableCell className="px-4 py-3.5 font-mono text-xs tabular-nums text-[#64748B]">
                    {major.sortOrder}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-sm font-semibold text-[#0F172A]">
                    {major.name}
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    {major.code ? (
                      <span className="inline-flex rounded-md bg-[#F1F5F9] px-2 py-0.5 font-mono text-xs font-semibold text-[#334155]">
                        {major.code}
                      </span>
                    ) : (
                      <span className="text-xs text-[#94A3B8]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-xs tabular-nums text-[#475569]">
                    {major.groupCount ?? 0} rombel
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(major)}
                          className="h-8 rounded-[8px] border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setDeleteTarget(major)}
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
        </section>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                {editingMajor ? "Edit Jurusan" : "Tambah Jurusan"}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Masukkan nama lengkap jurusan dan kode singkat (misalnya IPA,
                PPLG, TKJ).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label htmlFor="majorName" className="text-xs font-semibold text-[#334155]">
                  Nama Jurusan <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="majorName"
                  value={majorName}
                  onChange={(e) => setMajorName(e.target.value)}
                  placeholder="Contoh: Pengembangan Perangkat Lunak dan Gim"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="majorCode" className="text-xs font-semibold text-[#334155]">
                  Kode Singkat
                </label>
                <Input
                  id="majorCode"
                  value={majorCode}
                  onChange={(e) => setMajorCode(e.target.value.toUpperCase())}
                  placeholder="Contoh: PPLG"
                  className="h-10 rounded-[10px] border-[#CBD5E1] font-mono text-xs uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="majorSortOrder" className="text-xs font-semibold text-[#334155]">
                  Nomor Urutan Tampilan
                </label>
                <Input
                  id="majorSortOrder"
                  type="number"
                  value={majorSortOrder}
                  onChange={(e) => setMajorSortOrder(Number(e.target.value))}
                  className="h-10 rounded-[10px] border-[#CBD5E1] tabular-nums"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
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

      {/* Delete Confirmation */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#DC2626]">
              Hapus Jurusan
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Apakah Anda yakin ingin menghapus jurusan{" "}
              <strong className="text-[#0F172A]">{deleteTarget?.name}</strong>?
              Pastikan tidak ada rombel yang sedang menggunakan jurusan ini.
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
