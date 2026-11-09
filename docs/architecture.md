# Database Architecture & Schema — Votera

**Nama Aplikasi:** Votera  
**Database Engine:** Neon Serverless PostgreSQL (PostgreSQL 16+)  
**ORM & Migration Tool:** Drizzle ORM + `drizzle-kit`  
**Versi Dokumen:** 1.0.0  

---

## 1. Prinsip Arsitektur Database

1. **Multi-Election Ready:** Semua tabel operasional (`candidates`, `voters`, `votes`, `grade_levels`, `majors`, `voter_groups`, `audit_logs`) memiliki foreign key `election_id` yang merujuk ke tabel `elections`. Hal ini memungkinkan satu instalasi Votera dipakai untuk pemilihan berbeda atau lintas periode tahunan.
2. **Unlinkable Anonymous Ballot (Pemisahan Identitas & Suara):** Tabel `votes` **SAMA SEKALI TIDAK** memiliki kolom `voter_id`, `nis`, `ip_address`, atau referensi apa pun ke tabel `voters`. Status memilih dicatat di tabel `voters` (`has_voted`, `voter_status`, `voted_at`), sedangkan pilihan kandidat masuk ke tabel `votes`.  
   > **Catatan Sinkronisasi:** Kolom boolean `has_voted` adalah sumber kebenaran utama (*single source of truth*) untuk validasi hak suara. Kolom `voter_status = 'voted'` wajib selalu diperbarui secara bersamaan di dalam transaksi database atomik yang sama.
3. **Dual-Driver Neon Strategy:**
   - **Query Baca & CRUD Biasa (`dbHttp`):** Menggunakan `@neondatabase/serverless` via driver `drizzle-orm/neon-http` yang sangat cepat dan tanpa overhead koneksi TCP pada lingkungan serverless.
   - **Transaksi Interaktif & Pemungutan Suara (`dbPool`):** Menggunakan `Pool` WebSocket dari `@neondatabase/serverless` via `drizzle-orm/neon-serverless` untuk mengeksekusi transaksi atomik `dbPool.transaction(...)` saat submit suara dan impor DPT massal.
4. **Fleksibilitas Struktur Kelompok DPT:** Di layar PILKETOS terdapat filter **Tingkat** (`grade_levels`), **Jurusan** (`majors`), dan **Rombel/Kelas** (`voter_groups`). Ketiga tabel ini dibuat generik di database sehingga labelnya dapat dikustomisasi untuk organisasi lain (misal: `Fakultas` -> `Prodi` -> `Angkatan`, atau `RW` -> `RT` -> `Blok`).

---

## 2. Diagram Entity-Relationship (ERD Mermaid)

```mermaid
erDiagram
    users ||--o{ sessions : "has"
    users ||--o{ accounts : "has"
    users ||--o{ audit_logs : "actor (admin)"

    elections ||--|| election_settings : "configures"
    elections ||--o{ grade_levels : "defines"
    elections ||--o{ majors : "defines"
    elections ||--o{ voter_groups : "defines"
    elections ||--o{ candidates : "has"
    elections ||--o{ voters : "registers"
    elections ||--o{ votes : "records"
    elections ||--o{ audit_logs : "tracks"

    grade_levels ||--o{ voter_groups : "categorizes"
    majors ||--o{ voter_groups : "categorizes"
    voter_groups ||--o{ voters : "groups"

    candidates ||--o{ votes : "receives"
    voters ||--o{ voter_sessions : "authenticates"
    voters ||--o{ audit_logs : "actor (voter)"

    users {
        text id PK
        text name
        text email UK
        text username UK
        text role "super_admin | committee"
        boolean banned
        timestamp created_at
    }

    elections {
        uuid id PK
        text slug UK
        text title "e.g. Pemilihan Ketua OSIS 2026"
        text organization_name "e.g. SMA Bojong Gede"
        text status "draft | open | closed | archived"
        timestamp start_at
        timestamp end_at
        boolean is_active
        timestamp created_at
    }

    election_settings {
        uuid id PK
        uuid election_id FK, UK
        text id_label "default: NIS"
        text group_label "default: Rombel"
        text grade_label "default: Tingkat"
        text major_label "default: Jurusan"
        boolean is_result_public
        text logo_url
        text hero_banner_url
    }

    voter_groups {
        uuid id PK
        uuid election_id FK
        uuid grade_level_id FK
        uuid major_id FK
        text name "e.g. Rombel 1, XI IPA 1"
        integer sort_order
    }

    candidates {
        uuid id PK
        uuid election_id FK
        integer candidate_number "e.g. 1, 2, 3, 4"
        text name
        text class_or_unit "e.g. XI IPA, XI IPS"
        text motto
        text vision
        jsonb missions "string[]"
        jsonb programs "string[]"
        jsonb supporters "string[]"
        text photo_url
        text theme_color "red | green | blue | amber"
        boolean is_active
    }

    voters {
        uuid id PK
        uuid election_id FK
        uuid group_id FK
        text voter_identity "NIS / NIM / NIK"
        text name
        text token_hash "SHA-256 / Argon2id"
        text token_encrypted "AES-256-GCM for admin copy"
        text voter_status "not_voted | logged_in | voted"
        boolean has_voted
        integer failed_login_attempts
        timestamp locked_until
        timestamp last_login_at
        timestamp voted_at
    }

    votes {
        uuid id PK
        uuid election_id FK
        uuid candidate_id FK
        timestamp created_at "Truncated to minute for privacy"
    }

    audit_logs {
        uuid id PK
        uuid election_id FK
        text actor_type "admin | voter | system"
        text actor_id "user.id or voter.id"
        text actor_name "Snapshot nama pelaku"
        text actor_identity "Snapshot @username atau NIS"
        text action "admin_login | voter_login | vote_cast | etc"
        text description
        text ip_address
        timestamp created_at
    }
3. Kode Skema Drizzle ORM Lengkap (src/db/schema.ts)
Berikut adalah implementasi skema TypeScript lengkap menggunakan drizzle-orm/pg-core:

TypeScript
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
  idLabel: text("id_label").notNull().default("NIS"), // Bisa diganti NIM, NIK, ID Anggota
  groupLabel: text("group_label").notNull().default("Rombel"), // Bisa diganti Kelas, RT, Divisi
  gradeLabel: text("grade_label").notNull().default("Tingkat"), // Bisa diganti Angkatan, RW
  majorLabel: text("major_label").notNull().default("Jurusan"), // Bisa diganti Prodi, Unit
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
4. Konfigurasi Koneksi Dual-Driver Neon (src/db/index.ts)
TypeScript
import { neon, Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// Diperlukan untuk lingkungan Node.js saat memakai WebSocket Pool
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL (Pooled) wajib diisi di environment variables.");
}

// 1. Driver HTTP: Cepat untuk query SELECT & operasi non-transaksional
const sqlHttp = neon(process.env.DATABASE_URL);
export const db = drizzleHttp(sqlHttp, { schema });

// 2. Driver Serverless (WebSocket Pool): Wajib untuk transaksi interaktif (submit suara & batch import)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const dbPool = drizzleServerless(pool, { schema });
5. Contoh Query Agregat Hasil & Partisipasi (Server-Side)
Semua perhitungan suara dan partisipasi dilakukan melalui query agregasi (COUNT dan SUM CASE) di level PostgreSQL menggunakan db (neon-http), bukan menarik seluruh baris tabel votes ke memori Node.js.

TypeScript
import { db } from "@/db";
import { candidates, votes, voters, voterGroups } from "@/db/schema";
import { eq, sql, asc } from "drizzle-orm";

export async function getAggregatedElectionResults(electionId: string) {
  // 1. Ringkasan KPI DPT (Total, Sudah Memilih, Belum Memilih)
  const [dptSummary] = await db
    .select({
      totalVoters: sql<number>`count(*)::int`,
      votesCast: sql<number>`count(*) filter (where ${voters.hasVoted} = true)::int`,
      notVoted: sql<number>`count(*) filter (where ${voters.hasVoted} = false)::int`,
    })
    .from(voters)
    .where(eq(voters.electionId, electionId));

  // 2. Perolehan Suara per Kandidat (LEFT JOIN + GROUP BY)
  const candidateResults = await db
    .select({
      id: candidates.id,
      candidateNumber: candidates.candidateNumber,
      name: candidates.name,
      classOrUnit: candidates.classOrUnit,
      photoUrl: candidates.photoUrl,
      voteCount: sql<number>`count(${votes.id})::int`,
    })
    .from(candidates)
    .leftJoin(votes, eq(candidates.id, votes.candidateId))
    .where(
      sql`${candidates.electionId} = ${electionId} AND ${candidates.isActive} = true`
    )
    .groupBy(candidates.id)
    .orderBy(asc(candidates.candidateNumber));

  // 3. Partisipasi per Kelas / Rombel (untuk Dashboard & Laporan)
  const groupParticipation = await db
    .select({
      groupId: voterGroups.id,
      groupName: voterGroups.name,
      totalMembers: sql<number>`count(${voters.id})::int`,
      votedMembers: sql<number>`count(${voters.id}) filter (where ${voters.hasVoted} = true)::int`,
    })
    .from(voterGroups)
    .leftJoin(voters, eq(voterGroups.id, voters.groupId))
    .where(eq(voterGroups.electionId, electionId))
    .groupBy(voterGroups.id)
    .orderBy(asc(voterGroups.sortOrder));

  const totalVotes = dptSummary?.votesCast ?? 0;
  const totalVoters = dptSummary?.totalVoters ?? 0;

  return {
    summary: {
      totalVoters,
      votesCast: totalVotes,
      notVoted: dptSummary?.notVoted ?? 0,
      turnoutPercentage:
        totalVoters > 0 ? Number(((totalVotes / totalVoters) * 100).toFixed(1)) : 0,
    },
    candidates: candidateResults.map((c) => ({
      ...c,
      percentage:
        totalVotes > 0 ? Number(((c.voteCount / totalVotes) * 100).toFixed(1)) : 0,
    })),
    groupParticipation,
  };
}
6. Strategi Migrasi & Seeding Data Awal
6.1. Konfigurasi drizzle.config.ts
drizzle-kit wajib menggunakan DIRECT_DATABASE_URL (koneksi unpooled Neon tanpa -pooler) agar perintah DDL dan LOCK TABLE selama migrasi berjalan lancar.

TypeScript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
6.2. Strategi Seeding (src/db/seed.ts)
Script pnpm db:seed dirancang bersifat idempotent (onConflictDoNothing) dan mengisi data awal yang persis sama dengan demo PILKETOS 2026 - SMA Bojong Gede:

Super Admin Default: Username admin (super_admin), email admin@smabojonggede.sch.id, password dari env INITIAL_ADMIN_PASSWORD.

Pemilihan Default: PILKETOS 2026 — SMA Bojong Gede (Jadwal: 25/10/2026 07:00 s/d 02/11/2026 15:00).

Data Master:

Tingkat Kelas: Kelas X, Kelas XI, Kelas XII.

Jurusan: IPA, IPS.

Rombel: Rombel 1 s/d Rombel 7.

4 Kandidat Default:

#1 Raka Aditya Pratama (XI IPA — "Bersama Bergerak, Bersama Bersinar", tema red).

#2 Alya Putri Maharani (XI IPS — "Suara Kita, Aksi Nyata", tema green).

#3 Dimas Bagaskara (XI IPA — "Kreatif, Peduli, Berprestasi", tema blue).

#4 Nadia Safira Rahman (XI IPS — "Satu Langkah, Seribu Karya", tema amber).

Sample DPT: Siswa-siswa contoh seperti Aditya Pratama (2324001), Putri Ayu Lestari (2324004), Anisa Rahmawati (2324011), Deni Subekti (2024001), dll.
