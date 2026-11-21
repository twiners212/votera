# Project: Votera Admin API & UI Production Readiness

## Architecture
Votera is a high-security, high-concurrency electronic voting application for academic/institutional elections built on Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui, Neon PostgreSQL with Drizzle ORM, and TanStack Query.

### System Boundaries & Data Flow
1. **Admin Authentication & RBAC**:
   - Authentication via Better Auth sessions with `admin_sessions` and `users` tables.
   - Enforced by `requireAdminApiSession(allowedRoles)` in Route Handlers (`src/lib/auth/admin-guard.ts`).
   - Two administrative roles: `super_admin` (full permissions) and `committee` (read operations and day-of-election DPT management).
2. **Database Drivers Isolation**:
   - `db` (`drizzle-orm/neon-http`): Neon HTTP driver for low-latency single queries, fast reads, and non-transactional single-row mutations.
   - `dbPool` (`drizzle-orm/neon-serverless`): Neon Serverless WebSocket connection pool used for interactive multi-statement database transactions (`dbPool.transaction()`) in bulk operations.
   - Strictly locked database schema: `src/db/schema.ts` is never modified.
3. **Data Protection & Cryptography**:
   - Voter tokens generated with CSPRNG (unambiguous charset), hashed via HMAC-SHA256 (`TOKEN_HMAC_SECRET`), encrypted via AES-256-GCM (`TOKEN_ENCRYPTION_KEY`).
   - Privacy guarantee: In voter listings, voters with `hasVoted = true` have `tokenPlain = null`. Raw `votes` rows are never exposed. Voted voters cannot be deleted or have tokens reset (`409 CONFLICT`).
4. **Caching & Revalidation**:
   - High-throughput public/dashboard metrics cached via Next.js `unstable_cache` with a 3-second TTL and tag-based on-demand revalidation (`revalidateTag`).
5. **State Synchronization**:
   - TanStack Query v5 cache invalidation supporting both election UUID and `"active"` alias to keep all admin pages in sync across mutations.
6. **Import & Reporting**:
   - Robust CSV/XLSX parser up to 5,000 rows with CSV formula injection sanitization (CWE-1236).
   - 4-sheet Excel export with audit log trail and official Berita Acara PDF export with SHA-256 integrity hash.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Shared Admin Helpers & Validations | Common API response helpers, election resolution helper, and Zod schemas in `src/lib/validations/` | M1 | Survey 1 |
| 2 | Admin Dashboard API (`/api/admin/dashboard`) | Summary KPI metrics, rombel participation, readiness checklist, 5 recent audit logs with 3s `unstable_cache` | M1 | Survey 1 |
| 3 | Admin Results API (`/api/admin/results`) | Aggregated candidate results ranking, turnout percentage, rombel participation, zero raw votes exposure, 3s cache | M1 | Survey 1 |
| 4 | Candidates CRUD API (`/api/admin/candidates`) | List candidates, add/update/delete candidates (`super_admin` only), unique number validation, audit logs | M1 | Survey 1 |
| 5 | Photo Upload API (`/api/admin/upload`) | Binary magic bytes check (JPEG/PNG/WebP), <= 2MB limit, Vercel Blob with local dev fallback (`public/uploads/`) | M1 | Survey 1 |
| 6 | Voters Management API (`/api/admin/voters`) | Paginated voter list with search/filters, token decryption for unvoted, null token for voted, create/edit voter | M1 | Survey 1 |
| 7 | Voter Immutability & Security | Prevent token reset/copy/delete on voters who have voted (`hasVoted = true` returns 409 CONFLICT) | M1 | Survey 1 |
| 8 | Master Data API (`/api/admin/master`) | CRUD for grade levels, majors, and voter groups (`super_admin` for mutations, reference check on delete) | M1 | Survey 1 |
| 9 | Election Settings API (`/api/admin/settings`) | Get and update election configuration, schedule (`endAt > startAt`), labels, and public result visibility | M1 | Survey 1 |
| 10 | Audit Logs API (`/api/admin/logs`) | Read-only paginated audit trail query with search, actor, action, and date range filters | M1 | Survey 1 |
| 11 | Admin Users API (`/api/admin/users`) | List, create, update, delete admin users (`super_admin` only, password hashing via Better Auth, self-action guard) | M1 | Survey 1 |
| 12 | Automated Backend & RBAC Tests | Vitest suite (`tests/admin-api.test.ts`) testing RBAC matrix, upload security, voter security, and audit logs | M1 | Survey 1 |
| 13 | DPT Parser Module (`src/lib/importers/dpt-parser.ts`) | CSV/XLSX parser up to 5,000 rows, header normalization, duplicate detection, formula sanitization, transactional bulk insert via `dbPool` | M2 | Survey 2 |
| 14 | Bulk Import API Route (`/api/admin/voters/import`) | Server endpoint consuming DPT parser with partial success semantics, row error reporting, and audit logging | M2 | Survey 2 |
| 15 | Excel 4-Sheet Export Module (`src/lib/reports/export-excel.ts`) | Ringkasan, Hasil Kandidat, Partisipasi Rombel, and Log Aktivitas with cell formula escaping | M2 | Survey 2 |
| 16 | PDF Berita Acara Module (`src/lib/reports/export-pdf.ts`) | Official legal document with Crimson Kop Surat, KPI grid, tables, signature blocks, page numbers, and SHA-256 hash | M2 | Survey 2 |
| 17 | Automated DPT Parser Tests | Vitest suite (`tests/dpt-parser.test.ts`) covering formula rejection, 5,000 row limits, duplicates, and escaping | M2 | Survey 2 |
| 18 | Master Data & Settings Query Hooks | `useMasterData`, `useElectionSettings`, `useAdminUsers` hooks with complete query & mutation methods | M3 | Survey 3 |
| 19 | Synchronized Query Key Invalidation | Support dual invalidation for both UUID and `"active"` aliases across candidates, voters, settings, and master queries | M3 | Survey 3 |
| 20 | Admin UI Page: Classes (`/admin/classes`) | Rombel / grade level management view with role-based action gating adhering to DESIGN_NOTES.md | M3 | Survey 3 |
| 21 | Admin UI Page: Majors (`/admin/majors`) | Jurusan / major management view with role-based action gating | M3 | Survey 3 |
| 22 | Admin UI Page: Settings (`/admin/settings`) | Election configuration and schedule editor (`super_admin` only) | M3 | Survey 3 |
| 23 | Admin UI Page: Users (`/admin/users`) | User administration view (`super_admin` only) for managing admin accounts and roles | M3 | Survey 3 |
| 24 | Refactor Existing Views & Dialogs | Refactor `results-live-view.tsx`, `dpt-import-dialog.tsx`, `audit-logs-view.tsx`, and add role guards across admin panel | M3 | Survey 3 |
| 25 | E2E Testing Track & Verification | Comprehensive opaque-box and integration verification (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`) | M4 | Survey 1,2,3 |
| 26 | Coverage Hardening & Forensic Audit | Verification of zero diff on locked files, zero mock/dummy data, genuine cryptographic validation, clean audit verdict | M4 | Survey 1,2,3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Route Handlers & RBAC Security | Features 1–12: All `/api/admin/*` endpoints, RBAC matrix, Zod validations, audit logs, 3s cache, upload security, and `tests/admin-api.test.ts` | none | DONE |
| M2 | Data Import & Reporting Modules | Features 13–17: `dpt-parser.ts`, `/api/admin/voters/import`, `export-excel.ts`, `export-pdf.ts`, and `tests/dpt-parser.test.ts` | M1 | DONE |
| M3 | TanStack Query Hooks & Admin UI Pages | Features 18–24: `useMasterData`, `useSettings`, `useAdminUsers`, dual UUID/active invalidation, 4 new admin pages, and refactoring existing views | M1, M2 | DONE |
| M4 | Dual Track E2E Testing, Quality & Forensic Audit Gate | Features 25–26: Full test suite verification, build, lint, typecheck, zero diff on locked files, adversarial challenge, and forensic audit | M1, M2, M3 | DONE |

---

## Interface Contracts

### 1. Admin Authentication & Session Contract
```ts
// src/lib/auth/admin-guard.ts
export async function requireAdminApiSession(
  allowedRoles?: AdminRole[]
): Promise<{ session: AdminSessionResult; errorResponse: null } | { session: null; errorResponse: NextResponse }>;
```
- Returns 401 UNAUTHORIZED if not logged in.
- Returns 403 FORBIDDEN if session role is not in `allowedRoles`.

### 2. Election Resolution Helper Contract
```ts
// src/lib/admin/resolve-election.ts
export async function resolveTargetElectionId(electionRef?: string): Promise<string>;
```
- If `electionRef` is a valid UUID, returns it directly.
- If `electionRef === "active"` or omitted, queries DB for `isActive = true` (or latest created election).
- Throws / returns 404 error response if no election exists.

### 3. Server Caching & Revalidation Contract
```ts
// src/lib/admin/cached-aggregations.ts
export async function getCachedDashboardStats(electionId: string): Promise<DashboardStatsDTO>;
export async function getCachedElectionResults(electionId: string): Promise<ElectionResultsDTO>;
export async function revalidateElectionCaches(electionId: string): Promise<void>;
```

### 4. DPT Parser & Importer Contract
```ts
// src/lib/importers/dpt-parser.ts
export interface ParsedDptRow {
  rowNumber: number;
  voterIdentity: string;
  name: string;
  groupName: string;
  gradeName?: string;
  majorName?: string;
}

export interface DptImportResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  createdGroups: string[];
  failures: Array<{ rowNumber: number; voterIdentity: string; reason: string }>;
}

export function hasCsvFormulaPrefix(value: string): boolean;
export function escapeSpreadsheetCell(value: string): string;
export function parseDptBuffer(buffer: Buffer, filename: string): { rows: ParsedDptRow[]; errors: Array<{ rowNumber: number; reason: string }> };
export async function executeBulkImportTransaction(params: {
  electionId: string;
  rows: ParsedDptRow[];
  autoCreateGroups: boolean;
  adminActor: { id: string; name: string; identity: string; ipAddress?: string };
}): Promise<DptImportResult>;
```

### 5. Reporting Modules Contract
```ts
// src/lib/reports/export-excel.ts
export function generateResultsWorkbook(data: ElectionResultsDTO, auditLogs: AuditLogItem[]): Uint8Array;

// src/lib/reports/export-pdf.ts
export function generateBeritaAcaraPdf(data: ElectionResultsDTO, options: { electionTitle: string; verifiedHash: string }): Uint8Array;
```

### 6. TanStack Query Keys & Synchronization Contract
```ts
// src/lib/query-keys.ts
export const queryKeys = {
  election: {
    dashboard: (electionId: string) => ["election", electionId, "dashboard"] as const,
    results: (electionId: string) => ["election", electionId, "results"] as const,
  },
  candidates: {
    all: (electionId: string) => ["candidates", electionId] as const,
  },
  voters: {
    all: (electionId: string) => ["voters", electionId] as const,
    list: (electionId: string, filters?: unknown) => ["voters", electionId, "list", filters] as const,
  },
  master: {
    all: (electionId: string) => ["master", electionId] as const,
  },
  settings: {
    detail: (electionId: string) => ["settings", electionId] as const,
  },
  adminUsers: {
    all: () => ["admin-users"] as const,
  },
  logs: {
    all: (electionId: string) => ["audit-logs", electionId] as const,
    list: (electionId: string, filters?: unknown) => ["audit-logs", electionId, "list", filters] as const,
  },
};
```
- Invalidation helper: `invalidateElectionState(queryClient, electionId, { activeAlias: true })` invalidates both `[key, electionId]` and `[key, "active"]`.

---

## Code Layout & Ownership Boundaries

### Locked Files (STRICTLY UNTOUCHED)
- `src/app/globals.css`
- `src/db/schema.ts`

### Milestone 1: Backend Route Handlers & RBAC Security
- `src/lib/admin/api-response.ts` (API response formatting helper)
- `src/lib/admin/resolve-election.ts` (Election ID resolution)
- `src/lib/admin/cached-aggregations.ts` (3s `unstable_cache` & revalidation)
- `src/lib/validations/admin-common.ts`
- `src/lib/validations/candidate.ts`
- `src/lib/validations/voter-admin.ts`
- `src/lib/validations/master.ts`
- `src/lib/validations/settings.ts`
- `src/lib/validations/logs.ts`
- `src/lib/validations/user.ts`
- `src/app/api/admin/dashboard/route.ts`
- `src/app/api/admin/results/route.ts`
- `src/app/api/admin/candidates/route.ts`
- `src/app/api/admin/candidates/[id]/route.ts`
- `src/app/api/admin/upload/route.ts`
- `src/app/api/admin/voters/route.ts`
- `src/app/api/admin/voters/[id]/route.ts`
- `src/app/api/admin/voters/[id]/reset-token/route.ts`
- `src/app/api/admin/voters/[id]/copy-token/route.ts`
- `src/app/api/admin/master/route.ts`
- `src/app/api/admin/settings/route.ts`
- `src/app/api/admin/logs/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `tests/admin-api.test.ts`

### Milestone 2: Data Import & Reporting Modules
- `src/lib/importers/dpt-parser.ts`
- `src/app/api/admin/voters/import/route.ts`
- `src/lib/reports/export-excel.ts`
- `src/lib/reports/export-pdf.ts`
- `src/app/api/admin/results/export/route.ts`
- `tests/dpt-parser.test.ts`

### Milestone 3: TanStack Query Hooks & Admin UI Pages
- `src/hooks/use-master-data.ts`
- `src/hooks/use-settings.ts`
- `src/hooks/use-admin-users.ts`
- `src/hooks/use-candidates.ts` (update for dual invalidation)
- `src/hooks/use-voters.ts` (update for dual invalidation & copy-token)
- `src/lib/query-keys.ts` (update query keys)
- `src/app/admin/(panel)/classes/page.tsx`
- `src/app/admin/(panel)/majors/page.tsx`
- `src/app/admin/(panel)/settings/page.tsx`
- `src/app/admin/(panel)/users/page.tsx`
- `src/components/admin/classes-manager.tsx`
- `src/components/admin/majors-manager.tsx`
- `src/components/admin/settings-editor.tsx`
- `src/components/admin/users-manager.tsx`
- `src/components/admin/results-live-view.tsx` (refactor to use `export-excel.ts` and `export-pdf.ts`)
- `src/components/admin/dpt-import-dialog.tsx` (refactor to use `dpt-parser.ts`)
- `src/components/admin/audit-logs-view.tsx` (refactor to use query hooks & role filters)

### Milestone 4: Dual Track E2E Testing, Quality & Forensic Audit Gate
- Verification runs: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `git diff -- src/app/globals.css src/db/schema.ts`
- Challenger stress tests and test-coverage-audit
- Forensic Auditor integrity review
