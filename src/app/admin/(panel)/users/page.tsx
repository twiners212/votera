"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  UserPlus,
  Trash2,
  Shield,
  Loader2,
  AlertCircle,
  Lock,
  User,
  Mail,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { authClient } from "@/lib/auth/admin-client";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  username: string;
  displayUsername: string | null;
  role: "super_admin" | "committee";
  banned: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [isAddOpen, setIsAddOpen] = React.useState(false);

  // Form states
  const [name, setName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"committee" | "super_admin">("committee");

  const { data, isLoading, error } = useQuery<{ success: boolean; data: AdminUser[] }>({
    queryKey: queryKeys.adminUsers.all,
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Gagal mengambil daftar pengguna admin.");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal membuat akun.");
      return json;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all });
      toast.success("Admin Ditambahkan", { description: res.message });
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setRole("committee");
      setIsAddOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Gagal Membuat Admin", { description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; role?: string; banned?: boolean }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal memperbarui status.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all });
      toast.success("Status admin diperbarui.");
    },
    onError: (err: Error) => {
      toast.error("Gagal Memperbarui", { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Gagal menghapus admin.");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all });
      toast.success("Akun admin berhasil dihapus.");
    },
    onError: (err: Error) => {
      toast.error("Gagal Menghapus", { description: err.message });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !email.trim() || !password) return;
    createMutation.mutate({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
      role,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="p-6 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
        <p>Akses ditolak atau gagal memuat data administrator.</p>
      </div>
    );
  }

  const usersList = data.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Kelola Tim Administrator & Panitia
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Daftar petugas pengawas pemilihan dengan hak akses sistem (Role-Based Access Control).
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs font-medium bg-primary hover:bg-primary-hover text-white">
              <UserPlus className="w-3.5 h-3.5" />
              Tambah Petugas Panitia
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Tambah Akun Petugas</DialogTitle>
                <DialogDescription>
                  Petugas akan memiliki akses login ke panel panitia sesuai dengan peran yang diberikan.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Lengkap</label>
                  <Input
                    placeholder="Contoh: Rahmat Hidayat"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Username</label>
                    <Input
                      placeholder="Contoh: rahmat"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Peran (Role)</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full h-10 px-3 text-xs border rounded-md bg-white border-input focus:ring-1 focus:ring-primary"
                    >
                      <option value="committee">Panitia</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email Resmi</label>
                  <Input
                    type="email"
                    placeholder="Contoh: rahmat@smabojonggede.sch.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Kata Sandi Awal</label>
                  <Input
                    type="password"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-primary hover:bg-primary-hover text-white text-xs"
                >
                  {createMutation.isPending ? "Menyimpan..." : "Buat Akun Petugas"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border shadow-xs bg-white">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-base font-bold text-slate-800">
            Daftar Administrator ({usersList.length})
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Pengguna yang memiliki hak akses ke panel manajemen pemilihan.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-3 px-5">Nama & Username</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersList.map((u) => {
                  const isCurrent = u.id === session?.user?.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-5 font-semibold text-slate-800">
                        <div>
                          <span>{u.name}</span>
                          {isCurrent && (
                            <Badge variant="outline" className="ml-2 text-[10px] bg-slate-100">
                              Akun Kamu
                            </Badge>
                          )}
                        </div>
                        <div className="font-mono text-[11px] font-normal text-slate-400">
                          @{u.username}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {u.email}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            u.role === "super_admin"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {u.role === "super_admin" ? "Super Admin" : "Panitia"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {u.banned ? (
                          <Badge variant="outline" className="bg-red-100 text-red-800">
                            Diblokir
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Aktif
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        {!isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm(`Yakin ingin menghapus akses admin @${u.username}?`)) {
                                deleteMutation.mutate(u.id);
                              }
                            }}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
