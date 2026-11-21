import { z } from "zod";

export const electionRefSchema = z
  .string()
  .uuid("Format UUID pemilihan tidak valid.")
  .or(z.literal("active"))
  .optional();

export const uuidParamSchema = z.object({
  id: z.string().uuid("Format ID parameter tidak valid (harus UUID)."),
});

export const adminPaginationSchema = z.object({
  page: z.coerce.number().int().min(1, "Halaman minimal 1.").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit minimal 1.")
    .max(100, "Limit maksimal 100.")
    .default(25),
});
