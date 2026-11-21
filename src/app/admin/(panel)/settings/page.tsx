import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { SettingsEditor } from "@/components/admin/settings-editor";

export const metadata: Metadata = {
  title: "Pengaturan Pemilihan — Panel Panitia Votera",
  description: "Konfigurasi identitas acara, jadwal, label dinamis, dan publikasi hasil.",
};

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return <SettingsEditor electionId="active" role={session.user.role} />;
}
