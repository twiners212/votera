import { z } from "zod";

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

export const userQuerySchema = z.object({
  search: z.string().trim().optional(),
});

export const createAdminUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(32, "Username maksimal 32 karakter.")
    .refine(
      (val) => USERNAME_REGEX.test(val),
      "Username hanya boleh berisi huruf, angka, titik, strip, dan underscore."
    ),
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(120, "Nama maksimal 120 karakter."),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid.")
    .max(120, "Email maksimal 120 karakter."),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter.")
    .max(128, "Password maksimal 128 karakter."),
  role: z.enum(["committee", "super_admin"]).default("committee"),
});

export const updateAdminUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(120, "Nama maksimal 120 karakter.")
    .optional(),
  email: z
    .string()
    .trim()
    .email("Format email tidak valid.")
    .max(120, "Email maksimal 120 karakter.")
    .optional(),
  role: z.enum(["committee", "super_admin"]).optional(),
  banned: z.boolean().optional(),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter.")
    .max(128, "Password maksimal 128 karakter.")
    .optional(),
});
