import { z } from "zod";
import { electionRefSchema } from "./admin-common";

export const auditLogQuerySchema = z.object({
  electionId: electionRefSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  actorType: z.enum(["all", "admin", "voter", "system"]).default("all"),
  action: z.string().trim().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
