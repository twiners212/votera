import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata: Metadata = {
  title: "Kelola Pengguna Admin — Panel Panitia Votera",
  description: "Manajemen akun panitia dan hak akses administrator sistem.",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return (
    <UsersManager
      currentAdminId={session.user.id}
      role={session.user.role}
    />
  );
}
