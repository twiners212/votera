import { z } from "zod";
import { electionRefSchema } from "./admin-common";

export const candidateThemeSchema = z.enum(["red", "green", "blue", "amber"]);

export const candidateSchema = z.object({
  electionId: electionRefSchema,
  candidateNumber: z.coerce
    .number()
    .int("Nomor urut harus berupa bilangan bulat.")
    .min(1, "Nomor urut minimal 1.")
    .max(99, "Nomor urut maksimal 99."),
  name: z
    .string()
    .trim()
    .min(2, "Nama kandidat minimal 2 karakter.")
    .max(120, "Nama kandidat maksimal 120 karakter."),
  classOrUnit: z
    .string()
    .trim()
    .min(1, "Kelas atau unit minimal 1 karakter.")
    .max(60, "Kelas atau unit maksimal 60 karakter."),
  motto: z
    .string()
    .trim()
    .min(3, "Motto atau tagline minimal 3 karakter.")
    .max(200, "Motto atau tagline maksimal 200 karakter."),
  vision: z
    .string()
    .trim()
    .min(5, "Visi minimal 5 karakter.")
    .max(2000, "Visi maksimal 2000 karakter."),
  missions: z
    .array(
      z.string().trim().min(1, "Poin misi tidak boleh kosong.")
    )
    .min(1, "Minimal satu poin misi harus dicantumkan."),
  programs: z
    .array(z.string().trim().min(1, "Poin program tidak boleh kosong."))
    .default([]),
  supporters: z
    .array(z.string().trim().min(1, "Poin pendukung tidak boleh kosong."))
    .default([]),
  photoUrl: z.string().trim().nullable().optional(),
  themeColor: candidateThemeSchema.default("red"),
  isActive: z.boolean().default(true),
});

export const candidateUpdateSchema = candidateSchema
  .omit({ electionId: true })
  .partial();

export const candidateQuerySchema = z.object({
  electionId: electionRefSchema,
});
