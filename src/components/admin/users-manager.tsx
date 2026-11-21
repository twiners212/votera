"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
  type AdminUserDTO,
} from "@/hooks/use-admin-users";
import { cn, formatDateWIB } from "@/lib/utils";
import type { AdminRole } from "@/types/votera";

export interface UsersManagerProps {
  currentAdminId?: string;
  role?: AdminRole;
}

export function UsersManager({
  currentAdminId,
  role = "committee",
}: UsersManagerProps) {
  const isSuperAdmin = role === "super_admin";

  const { data, isLoading, isError, error, refetch, isFetching } =
    useAdminUsers();

  const createMutation = useCreateAdminUser();
  const updateMutation = useUpdateAdminUser();
  const deleteMutation = useDeleteAdminUser();

  const [search, setSearch] = React.useState("");

  // Create Dialog State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createUsername, setCreateUsername] = React.useState("");
  const [createEmail, setCreateEmail] = React.useState("");
  const [createPassword, setCreatePassword] = React.useState("");
  const [createRole, setCreateRole] = React.useState<AdminRole>("committee");

  // Edit Dialog State
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<AdminUserDTO | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editRole, setEditRole] = React.useState<AdminRole>("committee");
  const [editPassword, setEditPassword] = React.useState("");
  const [editBanned, setEditBanned] = React.useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = React.useState<AdminUserDTO | null>(
    null
  );

  const users = React.useMemo(() => data ?? [], [data]);

  // KPI Calculations
  const totalUsers = users.length;
  const superAdminCount = users.filter((u) => u.role === "super_admin").length;
  const committeeCount = users.filter((u) => u.role === "committee").length;
  const bannedCount = users.filter((u) => u.banned).length;

  // Filtered
  const filteredUsers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q))
    );
  }, [users, search]);

  // If not super admin, render 403 Access Denied
  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-[#0F172A] sm:text-2xl">
          Akses Terbatas: Khusus Super Admin
        </h1>
        <p className="mt-2 max-w-md text-sm text-[#475569]">
          Halaman manajemen pengguna admin hanya dapat diakses oleh akun dengan
          hak akses <strong className="text-[#0F172A]">Super Admin</strong>.
        </p>
        <Link href="/admin/dashboard" className="mt-6">
          <Button
            type="button"
            className="h-10 rounded-[10px] bg-[#D93829] px-5 text-xs font-semibold text-white hover:bg-[#B8281B]"
          >
            Kembali ke Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setCreateName("");
    setCreateUsername("");
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("committee");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createName.trim()) {
      toast.error("Nama lengkap tidak boleh kosong");
      return;
    }
    if (!createUsername.trim()) {
      toast.error("Username tidak boleh kosong");
      return;
    }
    if (!createEmail.trim()) {
      toast.error("Email tidak boleh kosong");
      return;
    }
    if (createPassword.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: createName.trim(),
        username: createUsername.trim().toLowerCase(),
        email: createEmail.trim().toLowerCase(),
        password: createPassword,
        role: createRole,
      });
      toast.success("Pengguna admin berhasil dibuat");
      setIsCreateOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membuat pengguna admin"
      );
    }
  };

  const handleOpenEdit = (user: AdminUserDTO) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword("");
    setEditBanned(Boolean(user.banned));
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editName.trim()) {
      toast.error("Nama lengkap tidak boleh kosong");
      return;
    }
    if (!editEmail.trim()) {
      toast.error("Email tidak boleh kosong");
      return;
    }
    if (editPassword && editPassword.length < 8) {
      toast.error("Password baru minimal 8 karakter");
      return;
    }

    const isSelf = editingUser.id === currentAdminId;
    if (isSelf && editRole !== "super_admin") {
      toast.error("Anda tidak dapat menurunkan role akun Anda sendiri");
      return;
    }
    if (isSelf && editBanned) {
      toast.error("Anda tidak dapat memblokir akun Anda sendiri");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingUser.id,
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: isSelf ? "super_admin" : editRole,
        banned: isSelf ? false : editBanned,
        ...(editPassword ? { password: editPassword } : {}),
      });
      toast.success("Data admin berhasil diperbarui");
      setIsEditOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memperbarui admin"
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.id === currentAdminId) {
      toast.error("Anda tidak dapat menghapus akun Anda sendiri");
      setDeleteTarget(null);
      return;
    }

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Pengguna admin berhasil dihapus");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus admin"
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">
            Kelola Pengguna Admin
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Kelola akun panitia pemilihan, hak akses super admin, dan status
            keamanan akun.
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

          <Button
            type="button"
            onClick={handleOpenCreate}
            className="h-10 rounded-[10px] bg-[#D93829] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#B8281B]"
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            <span>Tambah Admin</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Total Akun
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1F5F9] text-[#475569]">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0F172A]">
            {totalUsers}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Super Admin
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0F172A]">
            {superAdminCount}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Panitia
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF0EE] text-[#D93829]">
              <UserCheck className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#0F172A]">
            {committeeCount}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Akun Diblokir
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FEE2E2] text-[#DC2626]">
              <Ban className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-[#DC2626]">
            {bannedCount}
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
            placeholder="Cari nama, email, atau @username..."
            className="h-10 rounded-[10px] border-[#CBD5E1] bg-white pl-9 text-xs focus-visible:ring-[#D93829]/20"
          />
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#D93829]" />
          <p className="mt-3 text-sm text-[#64748B]">
            Memuat daftar pengguna admin...
          </p>
        </div>
      ) : isError ? (
        <div className="rounded-[12px] border border-[#FECACA] bg-[#FFF5F5] p-6 text-center text-[#DC2626]">
          <AlertCircle className="mx-auto h-8 w-8" />
          <p className="mt-2 text-sm font-semibold">
            Gagal memuat pengguna admin
          </p>
          <p className="text-xs text-[#64748B]">{error?.message}</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-8">
          <EmptyState
            icon={<UserCog className="h-5 w-5" />}
            title="Tidak ada pengguna ditemukan"
            description={
              search
                ? `Tidak ditemukan akun admin yang cocok dengan "${search}".`
                : "Belum ada akun admin terdaftar."
            }
          />
        </div>
      ) : (
        <section
          aria-label="Tabel pengguna admin"
          className="overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#F1F5F9] bg-[#F8FAFC]/60 hover:bg-transparent">
                <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Nama & Username
                </TableHead>
                <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Email
                </TableHead>
                <TableHead className="w-36 px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Peran (Role)
                </TableHead>
                <TableHead className="w-28 px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Status
                </TableHead>
                <TableHead className="w-44 px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Terdaftar Pada
                </TableHead>
                <TableHead className="w-36 px-4 text-right text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const isSelf = user.id === currentAdminId;
                return (
                  <TableRow
                    key={user.id}
                    className="border-b border-[#F1F5F9] transition-colors hover:bg-[#F8FAFC]"
                  >
                    <TableCell className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0F172A]">
                          {user.name}
                        </span>
                        {isSelf && (
                          <span className="inline-flex items-center rounded-md bg-[#FFF0EE] px-1.5 py-0.5 text-[10px] font-bold text-[#D93829]">
                            Anda
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-[#64748B]">
                        @{user.username}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3.5 text-xs text-[#475569]">
                      {user.email}
                    </TableCell>

                    <TableCell className="px-4 py-3.5">
                      {user.role === "super_admin" ? (
                        <span className="inline-flex items-center rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-bold text-[#DC2626]">
                          Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-bold text-[#334155]">
                          Panitia
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3.5">
                      {user.banned ? (
                        <span className="inline-flex items-center rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-bold text-[#DC2626]">
                          Diblokir
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-bold text-[#15803D]">
                          Aktif
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-3.5 text-xs tabular-nums text-[#64748B]">
                      {formatDateWIB(user.createdAt)}
                    </TableCell>

                    <TableCell className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(user)}
                          className="h-8 rounded-[8px] border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          <span>Edit</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isSelf}
                          onClick={() => setDeleteTarget(user)}
                          title={
                            isSelf
                              ? "Anda tidak dapat menghapus akun Anda sendiri"
                              : "Hapus akun"
                          }
                          className={cn(
                            "h-8 rounded-[8px] px-2.5 text-xs font-semibold",
                            isSelf
                              ? "cursor-not-allowed opacity-40 bg-[#F1F5F9] text-[#94A3B8]"
                              : "bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA]"
                          )}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          <span>Hapus</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {/* Modal Tambah Admin */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                Tambah Pengguna Admin
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Buat akun panitia atau super admin baru untuk mengelola
                pemilihan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label htmlFor="createName" className="text-xs font-semibold text-[#334155]">
                  Nama Lengkap <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="createName"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Contoh: Raka Aditya"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="createUsername" className="text-xs font-semibold text-[#334155]">
                  Username <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="createUsername"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value.toLowerCase())}
                  placeholder="Contoh: raka.panitia"
                  className="h-10 rounded-[10px] border-[#CBD5E1] font-mono text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="createEmail" className="text-xs font-semibold text-[#334155]">
                  Email <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="createEmail"
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value.toLowerCase())}
                  placeholder="Contoh: raka@sekolah.sch.id"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="createPassword" className="text-xs font-semibold text-[#334155]">
                  Password <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="createPassword"
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Minimal 8 karakter..."
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="createRole" className="text-xs font-semibold text-[#334155]">
                  Peran (Role)
                </label>
                <Select
                  value={createRole}
                  onValueChange={(val: AdminRole) => setCreateRole(val)}
                >
                  <SelectTrigger
                    id="createRole"
                    className="h-10 rounded-[10px] border-[#CBD5E1]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="committee">
                      Panitia (Operasional Pemilihan)
                    </SelectItem>
                    <SelectItem value="super_admin">
                      Super Admin (Akses Penuh Master, Pengaturan & User)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="h-10 rounded-[10px] border-[#CBD5E1] text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-10 rounded-[10px] bg-[#D93829] px-4 text-xs font-semibold text-white hover:bg-[#B8281B]"
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                <span>Buat Pengguna</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Edit Admin */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#0F172A]">
                Edit Pengguna Admin
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Perbarui data profil, peran, atau reset kata sandi pengguna.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label htmlFor="editName" className="text-xs font-semibold text-[#334155]">
                  Nama Lengkap <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="editEmail" className="text-xs font-semibold text-[#334155]">
                  Email <span className="text-[#DC2626]">*</span>
                </label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value.toLowerCase())}
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="editRole" className="text-xs font-semibold text-[#334155]">
                  Peran (Role)
                </label>
                <Select
                  value={editRole}
                  disabled={editingUser?.id === currentAdminId}
                  onValueChange={(val: AdminRole) => setEditRole(val)}
                >
                  <SelectTrigger
                    id="editRole"
                    className="h-10 rounded-[10px] border-[#CBD5E1]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="committee">
                      Panitia (Operasional Pemilihan)
                    </SelectItem>
                    <SelectItem value="super_admin">
                      Super Admin (Akses Penuh)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {editingUser?.id === currentAdminId && (
                  <p className="text-[11px] text-[#94A3B8]">
                    Anda tidak dapat mengubah peran akun Anda sendiri.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="editPassword" className="text-xs font-semibold text-[#334155]">
                  Ganti Password Baru (Opsional)
                </label>
                <Input
                  id="editPassword"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin mengubah password"
                  className="h-10 rounded-[10px] border-[#CBD5E1]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="editBanned"
                  checked={editBanned}
                  disabled={editingUser?.id === currentAdminId}
                  onCheckedChange={(checked) => setEditBanned(Boolean(checked))}
                />
                <label
                  htmlFor="editBanned"
                  className="text-xs font-semibold text-[#DC2626] cursor-pointer"
                >
                  Blokir akun ini (tidak dapat login)
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="h-10 rounded-[10px] border-[#CBD5E1] text-xs font-semibold"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="h-10 rounded-[10px] bg-[#D93829] px-4 text-xs font-semibold text-white hover:bg-[#B8281B]"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                <span>Simpan Perubahan</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Konfirmasi Hapus */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-[16px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#DC2626]">
              Hapus Pengguna Admin
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Apakah Anda yakin ingin menghapus akun{" "}
              <strong className="text-[#0F172A]">{deleteTarget?.name}</strong> (
              <span className="font-mono">@{deleteTarget?.username}</span>)?
              Aksi ini bersifat permanen dan tidak dapat dibatalkan.
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
