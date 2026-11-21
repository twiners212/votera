import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/admin-auth";

export const { GET, POST } = toNextJsHandler(auth);
