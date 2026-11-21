import { z } from "zod";
import { VOTER_TOKEN_ALPHABET } from "@/lib/crypto/token";

const TOKEN_REGEX = new RegExp(`^[${VOTER_TOKEN_ALPHABET}]{8}$`);

export const voterLoginSchema = z.object({
  electionId: z.string().uuid("ID pemilihan tidak valid").optional(),
  voterIdentity: z
    .string()
    .trim()
    .min(3, "NIS wajib diisi")
    .max(50, "NIS terlalu panjang"),
  token: z
    .string()
    .trim()
    .toUpperCase()
    .length(8, "Token harus terdiri dari 8 karakter")
    .regex(TOKEN_REGEX, "Format karakter token tidak valid"),
});

export const castVoteSchema = z.object({
  candidateId: z.string().uuid("Pilihan kandidat tidak valid"),
});

export type VoterLoginInput = z.infer<typeof voterLoginSchema>;
export type CastVoteInput = z.infer<typeof castVoteSchema>;
