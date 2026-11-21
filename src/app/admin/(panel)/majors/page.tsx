import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-guard";
import { MajorsManager } from "@/components/admin/majors-manager";

export const metadata: Metadata = {
  title: "Jurusan / Program Keahlian — Panel Panitia Votera",
  description: "Kelola data master jurusan dan program keahlian.",
};

export const dynamic = "force-dynamic";

export default async function AdminMajorsPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  return <MajorsManager electionId="active" role={session.user.role} />;
}
