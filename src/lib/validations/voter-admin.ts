import { z } from "zod";
import { electionRefSchema } from "./admin-common";

const FORMULA_INJECTION_REGEX = /^[=+\-@\t\r]/;
const IDENTITY_CHAR_REGEX = /^[a-zA-Z0-9_.-]+$/;

export const voterQuerySchema = z.object({
  electionId: electionRefSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  status: z.enum(["all", "not_voted", "logged_in", "voted"]).default("all"),
  groupId: z.string().uuid().or(z.literal("all")).optional(),
  gradeLevelId: z.string().uuid().or(z.literal("all")).optional(),
  majorId: z.string().uuid().or(z.literal("all")).optional(),
});

export const createVoterSchema = z.object({
  electionId: electionRefSchema,
  voterIdentity: z
    .string()
    .trim()
    .min(3, "Identitas pemilih minimal 3 karakter.")
    .max(50, "Identitas pemilih maksimal 50 karakter.")
    .refine(
      (val) => !FORMULA_INJECTION_REGEX.test(val),
      "Identitas pemilih tidak boleh diawali formula (=, +, -, @)."
    )
    .refine(
      (val) => IDENTITY_CHAR_REGEX.test(val),
      "Identitas pemilih hanya boleh berisi alfanumerik, strip, titik, dan underscore."
    ),
  name: z
    .string()
    .trim()
    .min(2, "Nama pemilih minimal 2 karakter.")
    .max(120, "Nama pemilih maksimal 120 karakter.")
    .refine(
      (val) => !FORMULA_INJECTION_REGEX.test(val),
      "Nama pemilih tidak boleh diawali formula (=, +, -, @)."
    ),
  groupId: z.string().uuid("ID rombel harus berupa UUID yang valid."),
});

export const updateVoterSchema = z.object({
  voterIdentity: z
    .string()
    .trim()
    .min(3, "Identitas pemilih minimal 3 karakter.")
    .max(50, "Identitas pemilih maksimal 50 karakter.")
    .refine(
      (val) => !FORMULA_INJECTION_REGEX.test(val),
      "Identitas pemilih tidak boleh diawali formula (=, +, -, @)."
    )
    .refine(
      (val) => IDENTITY_CHAR_REGEX.test(val),
      "Identitas pemilih hanya boleh berisi alfanumerik, strip, titik, dan underscore."
    )
    .optional(),
  name: z
    .string()
    .trim()
    .min(2, "Nama pemilih minimal 2 karakter.")
    .max(120, "Nama pemilih maksimal 120 karakter.")
    .refine(
      (val) => !FORMULA_INJECTION_REGEX.test(val),
      "Nama pemilih tidak boleh diawali formula (=, +, -, @)."
    )
    .optional(),
  groupId: z.string().uuid("ID rombel harus berupa UUID yang valid.").optional(),
});

export const importVoterRowSchema = z.object({
  voterIdentity: z
    .string()
    .trim()
    .min(3, "Identitas pemilih minimal 3 karakter.")
    .max(50, "Identitas pemilih maksimal 50 karakter.")
    .refine(
      (val) => !FORMULA_INJECTION_REGEX.test(val),
      "Identitas pemilih tidak boleh diawali formula (=, +, -, @)."
    ),
  name: z
    .string()
    .trim()
    .min(2, "Nama pemilih minimal 2 karakter.")
    .max(120, "Nama pemilih maksimal 120 karakter.")
    .refine(
      (val) => !FORMULA_INJECTION_REGEX.test(val),
      "Nama pemilih tidak boleh diawali formula (=, +, -, @)."
    ),
  groupName: z
    .string()
    .trim()
    .min(1, "Nama rombel wajib diisi.")
    .max(50, "Nama rombel maksimal 50 karakter.")
    .refine(
      (val) => !FORMULA_INJECTION_REGEX.test(val),
      "Nama rombel tidak boleh diawali formula (=, +, -, @)."
    ),
  gradeName: z.string().trim().max(50).optional(),
  majorName: z.string().trim().max(50).optional(),
});

export const bulkImportVotersSchema = z.object({
  electionId: electionRefSchema,
  autoCreateGroups: z.boolean().default(true),
  rows: z
    .array(importVoterRowSchema)
    .min(1, "Minimal 1 baris pemilih untuk diimpor.")
    .max(5000, "Maksimal 5.000 baris pemilih per batch impor."),
});

export const bulkDeleteVotersSchema = z
  .object({
    electionId: electionRefSchema,
    voterIds: z
      .array(z.string().uuid("ID pemilih harus berupa UUID yang valid."))
      .max(5000, "Maksimal 5.000 pemilih per batch penghapusan.")
      .optional(),
    allNotVoted: z.boolean().optional(),
  })
  .refine(
    (data) =>
      (data.voterIds && data.voterIds.length > 0) || data.allNotVoted === true,
    "Harus menyertakan daftar ID pemilih (voterIds) atau opsi allNotVoted = true."
  );
