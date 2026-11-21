import { z } from "zod";
import { electionRefSchema } from "./admin-common";

export const masterQuerySchema = z.object({
  electionId: electionRefSchema,
});

export const createGradeSchema = z.object({
  entity: z.literal("grade"),
  electionId: electionRefSchema,
  name: z.string().trim().min(1, "Nama tingkat tidak boleh kosong.").max(50),
  sortOrder: z.coerce.number().int().default(0),
});

export const createMajorSchema = z.object({
  entity: z.literal("major"),
  electionId: electionRefSchema,
  name: z.string().trim().min(1, "Nama jurusan tidak boleh kosong.").max(50),
  code: z.string().trim().max(20).nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const createGroupSchema = z.object({
  entity: z.literal("group"),
  electionId: electionRefSchema,
  name: z.string().trim().min(1, "Nama rombel tidak boleh kosong.").max(50),
  gradeLevelId: z.string().uuid("ID tingkat tidak valid.").nullable().optional(),
  majorId: z.string().uuid("ID jurusan tidak valid.").nullable().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const masterCreateSchema = z.discriminatedUnion("entity", [
  createGradeSchema,
  createMajorSchema,
  createGroupSchema,
]);

export const updateGradeSchema = z.object({
  entity: z.literal("grade"),
  id: z.string().uuid("ID tingkat harus berupa UUID."),
  name: z.string().trim().min(1, "Nama tingkat tidak boleh kosong.").max(50).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateMajorSchema = z.object({
  entity: z.literal("major"),
  id: z.string().uuid("ID jurusan harus berupa UUID."),
  name: z.string().trim().min(1, "Nama jurusan tidak boleh kosong.").max(50).optional(),
  code: z.string().trim().max(20).nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateGroupSchema = z.object({
  entity: z.literal("group"),
  id: z.string().uuid("ID rombel harus berupa UUID."),
  name: z.string().trim().min(1, "Nama rombel tidak boleh kosong.").max(50).optional(),
  gradeLevelId: z.string().uuid("ID tingkat tidak valid.").nullable().optional(),
  majorId: z.string().uuid("ID jurusan tidak valid.").nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const masterUpdateSchema = z.discriminatedUnion("entity", [
  updateGradeSchema,
  updateMajorSchema,
  updateGroupSchema,
]);

export const masterDeleteSchema = z.object({
  entity: z.enum(["grade", "major", "group"]),
  id: z.string().uuid("ID entitas harus berupa UUID."),
  electionId: electionRefSchema,
});
