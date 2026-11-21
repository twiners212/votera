import { z } from "zod";

export const resetElectionSchema = z.object({
  electionId: z.string().uuid("ID pemilihan harus berupa UUID yang valid."),
  confirmationText: z
    .string({ required_error: "Teks konfirmasi wajib diisi." })
    .trim()
    .refine((val) => val === "RESET PEMILIHAN", {
      message: 'Teks konfirmasi harus bernilai "RESET PEMILIHAN".',
    }),
  password: z
    .string({ required_error: "Password Super Admin wajib diisi." })
    .min(1, "Password Super Admin wajib diisi."),
  deleteMasterData: z.boolean().optional().default(false),
  deleteCandidates: z.boolean().optional().default(false),
});

export type ResetElectionInput = z.infer<typeof resetElectionSchema>;
