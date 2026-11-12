import type { Metadata } from "next";
import { AuditLogsView } from "@/components/admin/audit-logs-view";

export const metadata: Metadata = {
  title: "Log Aktivitas — Panel Panitia Votera",
  description:
    "Riwayat aktivitas panitia, pemilih, dan sistem yang bersifat read-only (hanya-baca).",
};

export default function AdminLogsPage() {
  return <AuditLogsView />;
}
