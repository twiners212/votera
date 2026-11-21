import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { and, desc, eq, lt, ne, or } from "drizzle-orm";
import { db, elections } from "@/db";
import * as schema from "@/db/schema";
import { insertAuditLog } from "@/lib/audit";
import { adminRolesConfig } from "@/lib/auth/admin-permissions";

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const authSecret =
  process.env.BETTER_AUTH_SECRET?.trim() ||
  (process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PHASE === "phase-production-build"
    ? "votera-dev-better-auth-secret-fallback-32chars"
    : undefined);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [
    username(),
    admin({
      roles: adminRolesConfig,
      defaultRole: "committee",
      adminRoles: ["super_admin"],
    }),
    nextCookies(),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": {
        window: 600, // 10 menit
        max: 5, // Maksimal 5 percobaan per 10 menit
      },
      "/sign-in/username": {
        window: 600, // 10 menit
        max: 5, // Maksimal 5 percobaan per 10 menit
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 hari
    updateAge: 60 * 60 * 24, // Refresh tiap 24 jam
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 menit
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          try {
            const [user] = await db
              .select({
                id: schema.users.id,
                name: schema.users.name,
                username: schema.users.username,
                email: schema.users.email,
                role: schema.users.role,
              })
              .from(schema.users)
              .where(eq(schema.users.id, session.userId))
              .limit(1);

            // Single-Device Enforcement for Super Admin
            // Revoke all older active sessions for this super_admin
            if (user?.role === "super_admin") {
              const sessionCreatedAt =
                session.createdAt instanceof Date
                  ? session.createdAt
                  : new Date(session.createdAt);

              await db
                .delete(schema.sessions)
                .where(
                  and(
                    eq(schema.sessions.userId, user.id),
                    ne(schema.sessions.id, session.id),
                    or(
                      lt(schema.sessions.createdAt, sessionCreatedAt),
                      and(
                        eq(schema.sessions.createdAt, sessionCreatedAt),
                        lt(schema.sessions.id, session.id)
                      )
                    )
                  )
                );
            }

            const [activeElection] = await db
              .select({ id: elections.id })
              .from(elections)
              .where(eq(elections.isActive, true))
              .orderBy(desc(elections.createdAt))
              .limit(1);

            if (user && activeElection) {
              const cleanUsername = user.username
                ? user.username.replace(/^@+/, "")
                : null;
              const actorIdentity = cleanUsername
                ? `@${cleanUsername}`
                : user.email;

              await insertAuditLog({
                electionId: activeElection.id,
                actorType: "admin",
                actorId: user.id,
                actorName: user.name,
                actorIdentity,
                action: "admin_login",
                actionTitle: "Admin login",
                description: "Admin atau panitia masuk ke panel",
                ipAddress: session.ipAddress ?? "::1",
              });
            }
          } catch (error) {
            console.error(
              "admin-auth databaseHooks session.create.after error:",
              error
            );
          }
        },
      },
    },
  },
  baseURL,
  secret: authSecret,
});
