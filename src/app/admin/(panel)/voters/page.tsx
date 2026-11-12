import type { Metadata } from "next";
import { VotersManager } from "@/components/admin/voters-manager";

export const metadata: Metadata = {
  title: "Pemilih (DPT) — Panel Panitia Votera",
  description:
    "Kelola daftar pemilih tetap (DPT), impor CSV/XLSX, salin token, dan pantau status pemungutan suara.",
};

export default function AdminVotersPage() {
  return <VotersManager electionId="active" />;
}
