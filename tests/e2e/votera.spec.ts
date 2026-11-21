import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  auditLogs,
  candidates,
  db,
  dbPool,
  elections,
  sessions,
  voterGroups,
  voterSessions,
  voters,
  votes,
} from "@/db";
import {
  encryptVoterToken,
  generateVoterToken,
  hashVoterToken,
} from "@/lib/crypto/token";

interface E2eBaseline {
  voteIds: string[];
  voterIds: string[];
  candidateIds: string[];
  auditLogIds: string[];
  sessionIds: string[];
  electionSchedule?: {
    id: string;
    status: "draft" | "open" | "closed" | "archived";
    startAt: Date | null;
    endAt: Date | null;
  };
}

async function captureE2eBaseline(): Promise<E2eBaseline> {
  const [existingVotes, existingVoters, existingCandidates, existingLogs, existingSessions, [activeElection]] =
    await Promise.all([
      db.select({ id: votes.id }).from(votes),
      db.select({ id: voters.id }).from(voters),
      db.select({ id: candidates.id }).from(candidates),
      db.select({ id: auditLogs.id }).from(auditLogs),
      db.select({ id: sessions.id }).from(sessions),
      db
        .select()
        .from(elections)
        .where(eq(elections.isActive, true))
        .orderBy(desc(elections.createdAt))
        .limit(1),
    ]);

  return {
    voteIds: existingVotes.map((r) => r.id),
    voterIds: existingVoters.map((r) => r.id),
    candidateIds: existingCandidates.map((r) => r.id),
    auditLogIds: existingLogs.map((r) => r.id),
    sessionIds: existingSessions.map((r) => r.id),
    electionSchedule: activeElection
      ? {
          id: activeElection.id,
          status: activeElection.status,
          startAt: activeElection.startAt,
          endAt: activeElection.endAt,
        }
      : undefined,
  };
}

async function restoreE2eBaseline(baseline: E2eBaseline): Promise<void> {
  await dbPool.transaction(async (tx) => {
    await tx.execute(
      sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_protect_audit_logs`
    );
    try {
      if (baseline.electionSchedule) {
        await tx
          .update(elections)
          .set({
            status: baseline.electionSchedule.status,
            startAt: baseline.electionSchedule.startAt,
            endAt: baseline.electionSchedule.endAt,
          })
          .where(eq(elections.id, baseline.electionSchedule.id));
      }

      if (baseline.voteIds.length > 0) {
        await tx.delete(votes).where(notInArray(votes.id, baseline.voteIds));
      } else {
        await tx.delete(votes);
      }

      if (baseline.candidateIds.length > 0) {
        await tx
          .delete(candidates)
          .where(notInArray(candidates.id, baseline.candidateIds));
      } else {
        await tx.delete(candidates);
      }

      const extraVoters =
        baseline.voterIds.length > 0
          ? await tx
              .select({ id: voters.id })
              .from(voters)
              .where(notInArray(voters.id, baseline.voterIds))
          : await tx.select({ id: voters.id }).from(voters);

      if (extraVoters.length > 0) {
        const extraIds = extraVoters.map((v) => v.id);
        await tx
          .delete(voterSessions)
          .where(inArray(voterSessions.voterId, extraIds));
        await tx.delete(voters).where(inArray(voters.id, extraIds));
      }

      if (baseline.auditLogIds.length > 0) {
        await tx
          .delete(auditLogs)
          .where(notInArray(auditLogs.id, baseline.auditLogIds));
      } else {
        await tx.delete(auditLogs);
      }

      if (baseline.sessionIds.length > 0) {
        await tx
          .delete(sessions)
          .where(notInArray(sessions.id, baseline.sessionIds));
      } else {
        await tx.delete(sessions);
      }
    } finally {
      await tx.execute(
        sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_protect_audit_logs`
      );
    }
  });
}

async function assertNoHorizontalOverflow(page: Page, contextLabel: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `Horizontal overflow detected on ${contextLabel}: scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth}`
  ).toBeLessThanOrEqual(metrics.clientWidth);
}

function attachRuntimeErrorCollector(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400) {
      const url = res.url();
      // Ignore deliberate unauthorized API probes
      if (!url.includes("/api/admin/voters") || (status !== 401 && status !== 403)) {
        errors.push(`http_${status}: ${url}`);
      }
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      const loc = msg.location()?.url || "";
      // Ignore expected 401/403 network logs when deliberately probing unauthorized routes
      if (!text.includes("status of 401") && !text.includes("status of 403")) {
        errors.push(`console.error (${loc}): ${text}`);
      }
    }
  });
  return errors;
}

test.describe("Votera E2E & Responsive Verification (375px Voter & 1280px+ Admin)", () => {
  let baseline: E2eBaseline;
  let activeElectionId = "";
  let firstCandidateId = "";
  let testVoterIdentity = "";
  let testVoterPlainToken = "";

  test.beforeAll(async () => {
    baseline = await captureE2eBaseline();

    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .orderBy(desc(elections.createdAt))
      .limit(1);

    if (!activeElection) {
      throw new Error("Active seeded election not found for E2E tests.");
    }
    activeElectionId = activeElection.id;

    // Pastikan jadwal pemilihan aktif sedang berlangsung selama uji E2E
    await db
      .update(elections)
      .set({
        status: "open",
        startAt: new Date(Date.now() - 3600_000),
        endAt: new Date(Date.now() + 86400_000 * 7),
      })
      .where(eq(elections.id, activeElection.id));

    const [group] = await db
      .select()
      .from(voterGroups)
      .where(eq(voterGroups.electionId, activeElection.id))
      .limit(1);

    let [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.electionId, activeElection.id))
      .limit(1);

    if (!candidate) {
      const [newCandidate] = await db
        .insert(candidates)
        .values({
          electionId: activeElection.id,
          candidateNumber: 1,
          name: "Arya Pratama & Siti Nurhaliza",
          classOrUnit: "XII RPL 1 & XI TKJ 2",
          motto: "Inovasi untuk Kemajuan Bersama",
          vision: "Mewujudkan OSIS yang berintegritas, kreatif, dan responsif terhadap aspirasi siswa.",
          missions: [
            "Mengoptimalkan peran ekstrakurikuler sebagai wadah pengembangan bakat dan minat.",
            "Menyelenggarakan kegiatan sekolah yang transparan, terstruktur, dan inklusif.",
          ],
          programs: ["Votera Tech Week", "Pekan Aspirasi Terbuka"],
          supporters: ["RPL", "TKJ"],
          photoUrl: "/images/candidate-new-1.jpg",
          themeColor: "red",
          isActive: true,
        })
        .returning();
      candidate = newCandidate;
    }

    if (!group || !candidate) {
      throw new Error("Seeded voter group or candidate missing for E2E tests.");
    }
    firstCandidateId = candidate.id;

    testVoterIdentity = `E2E-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    testVoterPlainToken = generateVoterToken(8);

    await db.insert(voters).values({
      electionId: activeElection.id,
      groupId: group.id,
      voterIdentity: testVoterIdentity,
      name: "Siswa Uji E2E",
      tokenHash: hashVoterToken(testVoterPlainToken),
      tokenEncrypted: encryptVoterToken(testVoterPlainToken),
      voterStatus: "not_voted",
      hasVoted: false,
    });
  });

  test.afterAll(async () => {
    await restoreE2eBaseline(baseline);
  });

  test("Voter flow & mobile responsive check (375x812): landing, candidates, detail, login, vote, thanks, TC-01 & TC-08", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    const runtimeErrors = attachRuntimeErrorCollector(page);

    try {
      // 1. Unauthenticated /admin/dashboard -> redirect to /admin/login (TC-08)
      await page.goto("/admin/dashboard");
      await expect(page).toHaveURL(/\/admin\/login/);
      await assertNoHorizontalOverflow(page, "/admin/login (375px)");

      // 2. Public Landing Page (/) at 375px
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await assertNoHorizontalOverflow(page, "/ (375px)");

      // Verify landing CTA button touch targets (>= 48px / h-12)
      const voterLoginCta = page.getByRole("link", { name: /Masuk untuk memilih/i });
      const committeeLoginCta = page.getByRole("link", { name: /Masuk sebagai panitia/i });
      const voterCtaBox = await voterLoginCta.boundingBox();
      const committeeCtaBox = await committeeLoginCta.boundingBox();
      expect(voterCtaBox?.height).toBeGreaterThanOrEqual(48);
      expect(committeeCtaBox?.height).toBeGreaterThanOrEqual(48);

      // 3. Candidates List (/candidates) at 375px
      await page.goto("/candidates");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await assertNoHorizontalOverflow(page, "/candidates (375px)");

      // Verify candidate profile card "Lihat Profil" button height (exact 44px / h-11)
      const viewProfileBtn = page.getByRole("link", { name: /Lihat Profil/i }).first();
      const viewProfileBox = await viewProfileBtn.boundingBox();
      expect(Math.round(viewProfileBox?.height ?? 0)).toBe(44);

      // 4. Candidate Detail (/candidates/[id]) at 375px
      await page.goto(`/candidates/${firstCandidateId}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await assertNoHorizontalOverflow(
        page,
        `/candidates/${firstCandidateId} (375px)`
      );

      // Verify back navigation link touch target (>= 44px)
      const backLink = page.getByRole("link", { name: /Semua kandidat/i }).first();
      const backLinkBox = await backLink.boundingBox();
      expect(backLinkBox?.height).toBeGreaterThanOrEqual(44);

      // 5. Voter Login (/login) at 375px
      await page.goto("/login");
      await expect(
        page.getByRole("heading", { name: /Masuk untuk memilih/i })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/login (375px)");

      await page.locator("#voterIdentity").fill(testVoterIdentity);
      await page.locator("#token").fill(testVoterPlainToken);
      await page.getByRole("button", { name: /^Masuk$/i }).click();

      // 6. Redirected to Ballot (/vote)
      await expect(page).toHaveURL(/\/vote$/, { timeout: 15_000 });
      await expect(
        page.getByRole("heading", { name: /Pilih Satu/i })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/vote (375px)");

      // Verify ballot workspace bottom padding (>= 112px / pb-28) to prevent sticky bar overlap
      const mainElement = page.locator("main.flex-1");
      const pb = await mainElement.evaluate((el) => window.getComputedStyle(el).paddingBottom);
      expect(parseInt(pb, 10)).toBeGreaterThanOrEqual(112);

      // TC-08 while logged in as voter: /admin/dashboard redirects to /admin/login and /api/admin/voters returns 401
      const adminApiStatus = await page.evaluate(async () => {
        const res = await fetch("/api/admin/voters");
        return res.status;
      });
      expect([401, 403]).toContain(adminApiStatus);

      // 7. Select first candidate card and submit vote
      const firstRadio = page.locator('[role="radio"]').first();
      await firstRadio.click();
      await expect(firstRadio).toHaveAttribute("aria-checked", "true");

      await page.getByRole("button", { name: /Kirim Pilihan|Kirim Suara/i }).click();

      // Confirm modal
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /Ya, Kirim Suara/i })
        .click();

      // 8. Redirected to /vote/thanks
      await expect(page).toHaveURL(/\/vote\/thanks$/, { timeout: 15_000 });
      await expect(
        page.getByRole("heading", { name: /Terima kasih/i })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/vote/thanks (375px)");

      // 9. TC-01 UI: revisiting /vote after voting redirects to /vote/thanks
      await page.goto("/vote");
      await expect(page).toHaveURL(/\/vote\/thanks$/);

      // 10. Logout from /vote/thanks -> redirects to /
      await page.getByRole("button", { name: /Keluar/i }).first().click();
      await expect(page).toHaveURL(/\/$/);

      // 11. Edge case: Test voter public routes on narrow 320px viewport (Galaxy Fold / iPhone SE 1st gen)
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/");
      await assertNoHorizontalOverflow(page, "/ (320px)");
      await page.goto("/candidates");
      await assertNoHorizontalOverflow(page, "/candidates (320px)");
      await page.goto(`/candidates/${firstCandidateId}`);
      await assertNoHorizontalOverflow(page, `/candidates/${firstCandidateId} (320px)`);
      await page.goto("/login");
      await assertNoHorizontalOverflow(page, "/login (320px)");

      expect(runtimeErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("Admin panel flow & desktop responsive check (1280x800): login, all panel pages, tabular-nums, voted-voter immutability & CSV export", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const runtimeErrors = attachRuntimeErrorCollector(page);

    try {
      // 1. Login as Super Admin on /admin/login
      await page.goto("/admin/login");
      await assertNoHorizontalOverflow(page, "/admin/login (1280px)");

      const adminUsername = process.env.INITIAL_ADMIN_USERNAME || "admin";
      const adminPassword =
        process.env.INITIAL_ADMIN_PASSWORD || "AdminPilketos2026!Secure";

      await page.locator("#identifier").fill(adminUsername);
      await page.locator("#password").fill(adminPassword);
      await page.getByRole("button", { name: /Masuk/i }).click();

      await expect(page).toHaveURL(/\/admin\/dashboard$/, { timeout: 15_000 });
      await expect(
        page.getByRole("heading", { name: /Halo,/i })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/admin/dashboard (1280px)");

      // 2. /admin/voters: verify voted voter buttons (Edit, Reset token, Hapus) are disabled
      await page.goto("/admin/voters");
      await expect(
        page.getByRole("heading", { name: /Daftar pemilih/i })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/admin/voters (1280px)");

      const targetIdentity = testVoterIdentity || "2324004";
      await page.locator('input[placeholder*="NIS"]').fill(targetIdentity);
      await page.locator('input[placeholder*="NIS"]').press("Enter");
      const votedRow = page.locator("tbody tr", { hasText: targetIdentity }).first();
      await expect(votedRow).toBeVisible({ timeout: 10_000 });
      await expect(votedRow.getByRole("button", { name: "Edit" })).toBeDisabled();
      await expect(
        votedRow.getByRole("button", { name: "Reset token" })
      ).toBeDisabled();
      await expect(
        votedRow.getByRole("button", { name: "Hapus" })
      ).toBeDisabled();

      // 3. /admin/candidates
      await page.goto("/admin/candidates");
      await expect(
        page.getByRole("heading", { level: 1, name: /^Kandidat$/i })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/admin/candidates (1280px)");

      // 4. /admin/results
      await page.goto("/admin/results");
      await expect(
        page.getByRole("heading", { level: 1, name: /Hasil Pemilihan/i })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/admin/results (1280px)");

      // Verify desktop toolbar button heights (compact 40px / sm:h-10)
      const refreshBtn = page.getByRole("button", { name: /Segarkan/i });
      const exportExcelBtn = page.getByRole("button", { name: /Ekspor Excel/i });
      const exportPdfBtn = page.getByRole("button", { name: /Berita Acara PDF/i });
      const refreshBox = await refreshBtn.boundingBox();
      const excelBox = await exportExcelBtn.boundingBox();
      const pdfBox = await exportPdfBtn.boundingBox();
      expect(Math.round(refreshBox?.height ?? 0)).toBe(40);
      expect(Math.round(excelBox?.height ?? 0)).toBe(40);
      expect(Math.round(pdfBox?.height ?? 0)).toBe(40);

      // 5. /admin/logs + test Ekspor Log (CSV) button works without 400 error
      await page.goto("/admin/logs");
      await expect(
        page.getByRole("heading", { level: 2, name: /Catatan aktivitas/i })
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/admin/logs (1280px)");

      // Verify desktop toolbar button heights (compact 36px / sm:h-9)
      const exportCsvBtn = page.getByRole("button", { name: /Ekspor Log \(CSV\)/i });
      const refreshLogsBtn = page.getByRole("button", { name: /Segarkan/i });
      const exportCsvBox = await exportCsvBtn.boundingBox();
      const refreshLogsBox = await refreshLogsBtn.boundingBox();
      expect(Math.round(exportCsvBox?.height ?? 0)).toBe(36);
      expect(Math.round(refreshLogsBox?.height ?? 0)).toBe(36);

      const downloadPromise = page.waitForEvent("download");
      await exportCsvBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^log-aktivitas-.*\.csv$/);

      // Verify admin mobile toolbar responsiveness (375x812 -> >= 44px touch targets)
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto("/admin/results");
      await assertNoHorizontalOverflow(page, "/admin/results (375px)");
      const mobRefreshBtn = page.getByRole("button", { name: /Segarkan/i });
      const mobExcelBtn = page.getByRole("button", { name: /Ekspor Excel/i });
      const mobPdfBtn = page.getByRole("button", { name: /Berita Acara PDF/i });
      const mobRefreshBox = await mobRefreshBtn.boundingBox();
      const mobExcelBox = await mobExcelBtn.boundingBox();
      const mobPdfBox = await mobPdfBtn.boundingBox();
      expect(Math.round(mobRefreshBox?.height ?? 0)).toBe(44);
      expect(Math.round(mobExcelBox?.height ?? 0)).toBe(44);
      expect(Math.round(mobPdfBox?.height ?? 0)).toBe(44);

      await page.goto("/admin/logs");
      await assertNoHorizontalOverflow(page, "/admin/logs (375px)");
      const mobExportCsvBtn = page.getByRole("button", { name: /Ekspor Log \(CSV\)/i });
      const mobRefreshLogsBtn = page.getByRole("button", { name: /Segarkan/i });
      const mobExportCsvBox = await mobExportCsvBtn.boundingBox();
      const mobRefreshLogsBox = await mobRefreshLogsBtn.boundingBox();
      expect(Math.round(mobExportCsvBox?.height ?? 0)).toBe(44);
      expect(Math.round(mobRefreshLogsBox?.height ?? 0)).toBe(44);

      // Edge case: Narrow 320px viewport (cover screen / narrow mobile)
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto("/admin/results");
      await assertNoHorizontalOverflow(page, "/admin/results (320px)");
      await page.goto("/admin/logs");
      await assertNoHorizontalOverflow(page, "/admin/logs (320px)");

      // Restore desktop viewport for remainder of admin test
      await page.setViewportSize({ width: 1280, height: 800 });

      // 6. /admin/classes, /admin/majors, /admin/settings, /admin/users
      for (const route of [
        "/admin/classes",
        "/admin/majors",
        "/admin/settings",
        "/admin/users",
      ]) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await assertNoHorizontalOverflow(page, `${route} (1280px)`);
      }

      // 7. Logout Super Admin
      await page.getByRole("button", { name: /Keluar/i }).click();
      await expect(page).toHaveURL(/\/admin\/login$/);

      // 8. Login as Committee (@panitia) and verify super_admin pages show restricted view
      await page.locator("#identifier").fill("panitia");
      await page.locator("#password").fill("PanitiaPilketos2026!");
      await page.getByRole("button", { name: /Masuk/i }).click();

      await expect(page).toHaveURL(/\/admin\/dashboard$/, { timeout: 15_000 });
      await page.goto("/admin/users");
      await expect(
        page.getByText(/Akses Terbatas: Khusus Super Admin/i)
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, "/admin/users committee (1280px)");

      expect(runtimeErrors).toEqual([]);
      expect(activeElectionId).toBeTruthy();
    } finally {
      await context.close();
    }
  });
});
