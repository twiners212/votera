import { z } from "zod";
import { electionRefSchema } from "./admin-common";

export const settingsQuerySchema = z.object({
  electionId: electionRefSchema,
});

export const updateSettingsSchema = z
  .object({
    electionId: electionRefSchema,
    shortName: z
      .string()
      .trim()
      .min(2, "Nama singkat pemilihan minimal 2 karakter.")
      .max(50, "Nama singkat pemilihan maksimal 50 karakter.")
      .optional(),
    title: z
      .string()
      .trim()
      .min(2, "Judul pemilihan minimal 2 karakter.")
      .max(150, "Judul pemilihan maksimal 150 karakter.")
      .optional(),
    organizationName: z
      .string()
      .trim()
      .min(2, "Nama instansi/sekolah minimal 2 karakter.")
      .max(120, "Nama instansi/sekolah maksimal 120 karakter.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "Deskripsi maksimal 500 karakter.")
      .nullable()
      .optional(),
    status: z.enum(["draft", "open", "closed", "archived"]).optional(),
    startAt: z
      .string()
      .nullable()
      .optional()
      .refine(
        (val) => !val || !isNaN(Date.parse(val)),
        "Format tanggal mulai tidak valid."
      ),
    endAt: z
      .string()
      .nullable()
      .optional()
      .refine(
        (val) => !val || !isNaN(Date.parse(val)),
        "Format tanggal selesai tidak valid."
      ),
    idLabel: z
      .string()
      .trim()
      .min(1, "Label identitas tidak boleh kosong.")
      .max(30)
      .optional(),
    groupLabel: z
      .string()
      .trim()
      .min(1, "Label rombel tidak boleh kosong.")
      .max(30)
      .optional(),
    gradeLabel: z
      .string()
      .trim()
      .min(1, "Label tingkat tidak boleh kosong.")
      .max(30)
      .optional(),
    majorLabel: z
      .string()
      .trim()
      .min(1, "Label jurusan tidak boleh kosong.")
      .max(30)
      .optional(),
    isResultPublic: z.boolean().optional(),
    logoUrl: z.string().trim().nullable().optional(),
    heroBannerUrl: z.string().trim().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.endAt).getTime() > new Date(data.startAt).getTime();
      }
      return true;
    },
    {
      message: "Waktu selesai pemilihan harus lebih besar dari waktu mulai.",
      path: ["endAt"],
    }
  )
  .refine(
    (data) => {
      if (data.status === "open" && data.endAt) {
        return new Date(data.endAt).getTime() > Date.now();
      }
      return true;
    },
    {
      message:
        "Waktu selesai pemilihan harus berada di masa depan jika status pemilihan Open.",
      path: ["endAt"],
    }
  );
