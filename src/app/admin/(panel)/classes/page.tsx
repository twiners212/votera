import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { ClassesManager } from "@/components/admin/classes-manager";

export const metadata: Metadata = {
  title: "Tingkat Kelas & Rombel — Panel Panitia Votera",
  description: "Kelola data master tingkat kelas dan rombel/kelompok pemilih.",
};

export const dynamic = "force-dynamic";

export default async function AdminClassesPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return <ClassesManager electionId="active" role={session.user.role} />;
}
