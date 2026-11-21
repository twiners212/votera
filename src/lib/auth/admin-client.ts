"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";
import { adminRolesConfig } from "@/lib/auth/admin-permissions";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    adminClient({
      roles: adminRolesConfig,
    }),
  ],
});
