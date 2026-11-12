import type { Metadata } from "next";
import { DashboardOverview } from "@/components/admin/dashboard-overview";

export const metadata: Metadata = {
  title: "Dashboard — Votera Admin",
  description:
    "Ringkasan statistik pemilihan, partisipasi pemilih, kesiapan pemilihan, dan log aktivitas terbaru.",
};

export default function AdminDashboardPage() {
  return <DashboardOverview />;
}
