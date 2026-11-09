import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// =========================================================
// 1. ENUMS
// =========================================================

export const adminRoleEnum = pgEnum("admin_role", ["super_admin", "committee"]);

export const electionStatusEnum = pgEnum("election_status", [
  "draft",
  "open",
  "closed",
  "archived",
]);

export const voterStatusEnum = pgEnum("voter_status", [
  "not_voted", // "Belum memilih"
  "logged_in", // "Sudah login"
  "voted",     // "Sudah memilih"
]);

export const actorTypeEnum = pgEnum("actor_type", [
  "admin",
  "voter",
  "system",
]);

export const candidateThemeEnum = pgEnum("candidate_theme", [
  "red",
  "green",
  "blue",
  "amber",
]);

// =========================================================
// 2. BETTER AUTH TABLES (Admin & Committee Authentication)
// =========================================================

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  image: text("image"),
  role: adminRoleEnum("role").notNull().default("committee"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("accounts_user_id_idx").on(table.userId)]
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// =========================================================
// 3. ELECTIONS & SETTINGS TABLES
// =========================================================

export const elections = pgTable(
  "elections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(), // e.g., "pilketos-2026"
    shortName: text("short_name").notNull().default("PILKETOS 2026"),
    title: text("title").notNull().default("Pemilihan Ketua OSIS 2026"),
    organizationName: text("organization_name").notNull().default("SMA Bojong Gede"),
    description: text("description").default(
      "Kenali calon ketua sebelum menentukan pilihan. Suara kamu dijaga kerahasiaannya dan hanya bisa digunakan satu kali."
    ),
    status: electionStatusEnum("status").notNull().default("draft"),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("elections_is_active_idx").on(table.isActive)]
);

export const electionSettings = pgTable("election_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  electionId: uuid("election_id")
    .notNull()
    .unique()
    .references(() => elections.id, { onDelete: "cascade" }),
  idLabel: text("id_label").notNull().default("NIS"), // e.g., NIM, NIK, ID Anggota
  groupLabel: text("group_label").notNull().default("Rombel"), // e.g., Kelas, RT, Divisi
  gradeLabel: text("grade_label").notNull().default("Tingkat"), // e.g., Angkatan, RW
  majorLabel: text("major_label").notNull().default("Jurusan"), // e.g., Prodi, Unit
  isResultPublic: boolean("is_result_public").notNull().default(false),
  logoUrl: text("logo_url"),
  heroBannerUrl: text("hero_banner_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// =========================================================
// 4. MASTER DATA TABLES (Tingkat Kelas, Jurusan, Rombel)
// =========================================================

export const gradeLevels = pgTable(
  "grade_levels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Kelas X", "Kelas XI", "Kelas XII"
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("grade_levels_election_name_uq").on(table.electionId, table.name),
  ]
);

export const majors = pgTable(
  "majors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "IPA", "IPS"
    code: text("code"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("majors_election_name_uq").on(table.electionId, table.name),
  ]
);

export const voterGroups = pgTable(
  "voter_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    gradeLevelId: uuid("grade_level_id").references(() => gradeLevels.id, {
      onDelete: "set null",
    }),
    majorId: uuid("major_id").references(() => majors.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(), // e.g., "Rombel 1", "Rombel 2"
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("voter_groups_election_name_uq").on(table.electionId, table.name),
    index("voter_groups_election_idx").on(table.electionId),
  ]
);

// =========================================================
// 5. CANDIDATES TABLE
// =========================================================

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    candidateNumber: integer("candidate_number").notNull(), // #1, #2, #3, #4
    name: text("name").notNull(),
    classOrUnit: text("class_or_unit").notNull(), // e.g., "XI IPA", "XI IPS"
    motto: text("motto").notNull(),
    vision: text("vision").notNull(),
    missions: jsonb("missions").$type<string[]>().notNull().default([]),
    programs: jsonb("programs").$type<string[]>().notNull().default([]),
    supporters: jsonb("supporters").$type<string[]>().notNull().default([]),
    photoUrl: text("photo_url"),
    themeColor: candidateThemeEnum("theme_color").notNull().default("red"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("candidates_election_number_uq").on(
      table.electionId,
      table.candidateNumber
    ),
    index("candidates_election_active_idx").on(table.electionId, table.isActive),
  ]
);

// =========================================================
// 6. VOTERS (DPT) & VOTER SESSIONS TABLES
// =========================================================

export const voters = pgTable(
  "voters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => voterGroups.id, { onDelete: "restrict" }),
    voterIdentity: text("voter_identity").notNull(), // NIS e.g. "2324001"
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(), // HMAC-SHA256 hash untuk verifikasi login cepat
    tokenEncrypted: text("token_encrypted").notNull(), // AES-256-GCM ciphertext untuk fitur "Salin" di tabel DPT
    voterStatus: voterStatusEnum("voter_status").notNull().default("not_voted"),
    hasVoted: boolean("has_voted").notNull().default(false),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    votedAt: timestamp("voted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("voters_election_identity_uq").on(
      table.electionId,
      table.voterIdentity
    ),
    index("voters_election_group_idx").on(table.electionId, table.groupId),
    index("voters_election_status_idx").on(table.electionId, table.voterStatus),
    index("voters_election_has_voted_idx").on(table.electionId, table.hasVoted),
  ]
);

export const voterSessions = pgTable(
  "voter_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => voters.id, { onDelete: "cascade" }),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("voter_sessions_voter_id_idx").on(table.voterId)]
);

// =========================================================
// 7. VOTES TABLE (STRICTLY ANONYMOUS - NO VOTER_ID!)
// =========================================================

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id, { onDelete: "restrict" }),
    // PENTING: DILARANG MENAMBAHKAN voter_id ATAU ip_address DI TABEL INI!
    // createdAt dibulatkan per menit (date_trunc) saat insert untuk mencegah timing correlation attack.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`date_trunc('minute', now())`),
  },
  (table) => [
    index("votes_election_candidate_idx").on(table.electionId, table.candidateId),
  ]
);

// =========================================================
// 8. AUDIT LOGS TABLE (APPEND-ONLY)
// =========================================================

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    actorType: actorTypeEnum("actor_type").notNull(), // 'admin' | 'voter' | 'system'
    actorId: text("actor_id"), // users.id atau voters.id
    actorName: text("actor_name").notNull(), // e.g., "Super Admin" atau "Putri Ayu Lestari"
    actorIdentity: text("actor_identity").notNull(), // e.g., "@admin" atau "NIS 2324004"
    action: text("action").notNull(), // e.g., "admin_login", "voter_login", "vote_cast", "voter_logout"
    actionTitle: text("action_title").notNull(), // e.g., "Admin login", "Vote cast", "Pemilih login"
    description: text("description").notNull(), // e.g., "Pemilih telah memberikan suara"
    ipAddress: text("ip_address").notNull().default("::1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_election_created_idx").on(table.electionId, table.createdAt),
    index("audit_logs_election_actor_type_idx").on(table.electionId, table.actorType),
    index("audit_logs_election_action_idx").on(table.electionId, table.action),
  ]
);

// =========================================================
// 9. DRIZZLE RELATIONS
// =========================================================

export const electionsRelations = relations(elections, ({ one, many }) => ({
  settings: one(electionSettings, {
    fields: [elections.id],
    references: [electionSettings.electionId],
  }),
  gradeLevels: many(gradeLevels),
  majors: many(majors),
  voterGroups: many(voterGroups),
  candidates: many(candidates),
  voters: many(voters),
  votes: many(votes),
  auditLogs: many(auditLogs),
}));

export const voterGroupsRelations = relations(voterGroups, ({ one, many }) => ({
  election: one(elections, {
    fields: [voterGroups.electionId],
    references: [elections.id],
  }),
  gradeLevel: one(gradeLevels, {
    fields: [voterGroups.gradeLevelId],
    references: [gradeLevels.id],
  }),
  major: one(majors, {
    fields: [voterGroups.majorId],
    references: [majors.id],
  }),
  voters: many(voters),
}));

export const votersRelations = relations(voters, ({ one, many }) => ({
  election: one(elections, {
    fields: [voters.electionId],
    references: [elections.id],
  }),
  group: one(voterGroups, {
    fields: [voters.groupId],
    references: [voterGroups.id],
  }),
  sessions: many(voterSessions),
}));

export const candidatesRelations = relations(candidates, ({ one, many }) => ({
  election: one(elections, {
    fields: [candidates.electionId],
    references: [elections.id],
  }),
  votes: many(votes),
}));
