import crypto from "node:crypto";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { hashPassword } from "better-auth/crypto";
import * as schema from "./schema";
import {
  VOTER_TOKEN_ALPHABET,
  hashVoterToken,
  encryptVoterToken,
} from "../lib/crypto/token";

try {
  if (
    typeof (process as unknown as { loadEnvFile?: (path: string) => void })
      .loadEnvFile === "function"
  ) {
    (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile(
      ".env.local"
    );
  }
} catch {
  // Ignore if .env.local doesn't exist
}

neonConfig.webSocketConstructor = ws;

function deterministicUuid(seedKey: string): string {
  const hash = crypto.createHash("sha256").update(seedKey).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function deterministicVoterToken(nis: string): string {
  const digest = crypto.createHash("sha256").update(`votera-seed-${nis}`).digest();
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += VOTER_TOKEN_ALPHABET[digest[i] % VOTER_TOKEN_ALPHABET.length];
  }
  return token;
}

const DEMO_VOTERS: Array<{
  nis: string;
  name: string;
  rombelIdx: number;
  status: "not_voted" | "logged_in" | "voted";
  token?: string;
  votedCandidateNumber?: number;
}> = [
  { nis: "2324001", name: "Aditya Pratama", rombelIdx: 0, status: "not_voted", token: "JUFT88TF" },
  { nis: "2324002", name: "Ahmad Fauzi", rombelIdx: 0, status: "not_voted", token: "WPMTTE6G" },
  { nis: "2324003", name: "Dewi Sartika", rombelIdx: 0, status: "not_voted", token: "HHZU7B48" },
  { nis: "2324004", name: "Putri Ayu Lestari", rombelIdx: 1, status: "voted", votedCandidateNumber: 1 },
  { nis: "2324005", name: "Budi Santoso", rombelIdx: 1, status: "voted", votedCandidateNumber: 1 },
  { nis: "2324006", name: "Citra Lestari", rombelIdx: 1, status: "not_voted" },
  { nis: "2324007", name: "Doni Prasetyo", rombelIdx: 2, status: "not_voted" },
  { nis: "2324008", name: "Eka Rahmawati", rombelIdx: 2, status: "not_voted" },
  { nis: "2324009", name: "Fajar Nugraha", rombelIdx: 2, status: "not_voted" },
  { nis: "2324010", name: "Gita Permata", rombelIdx: 2, status: "not_voted" },
  { nis: "2324011", name: "Anisa Rahmawati", rombelIdx: 3, status: "not_voted", token: "P8TYM5KR" },
  { nis: "2324012", name: "Hendra Wijaya", rombelIdx: 3, status: "not_voted" },
  { nis: "2324013", name: "Indah Kusumawati", rombelIdx: 3, status: "not_voted" },
  { nis: "2324014", name: "Joko Supriyanto", rombelIdx: 4, status: "not_voted" },
  { nis: "2324015", name: "Kartika Sari", rombelIdx: 4, status: "not_voted" },
  { nis: "2324016", name: "Lukman Hakim", rombelIdx: 4, status: "not_voted" },
  { nis: "2324017", name: "Mega Utami", rombelIdx: 5, status: "not_voted" },
  { nis: "2324018", name: "Naufal Ramadhan", rombelIdx: 5, status: "not_voted" },
  { nis: "2324019", name: "Olivia Maharani", rombelIdx: 5, status: "not_voted" },
  { nis: "2024001", name: "Deni Subekti", rombelIdx: 6, status: "not_voted" },
  { nis: "2024002", name: "Rian Hidayat", rombelIdx: 6, status: "not_voted" },
  { nis: "2024003", name: "Siti Nurhaliza", rombelIdx: 6, status: "not_voted" },
];

const EXTRA_STUDENT_NAMES = [
  "Bagas Saputra", "Clarissa Putri", "Daffa Maulana", "Elsa Febriani",
  "Farhan Rizky", "Ghea Ananda", "Hafiz Kurniawan", "Intan Permatasari",
  "Jeremy Christian", "Keyla Azzahra", "Lutfi Ramadhan", "Mawar Melati",
  "Nabilah Syifa", "Oscar Pratama", "Puspita Sari", "Qoriatus Sholehah",
  "Rafi Akbar", "Salsaabila Nur", "Taufik Hidayat", "Umi Kulsum",
  "Vino Sebastian", "Winda Astuti", "Xavier Wijaya", "Yasmine Putri",
  "Zaki Mubarak", "Adinda Kinanti", "Bima Sena", "Cahya Ningrum",
  "Danang Setiawan", "Erina Damayanti", "Fikri Alamsyah", "Galuh Chandra",
  "Hana Mardiana", "Ilham Bintang", "Jihan Aulia", "Kevin Sanjaya",
  "Larasati Dewi", "Miftahul Huda", "Nadia Putri", "Oki Setiana",
  "Pandu Winata", "Qiana Azalea", "Reza Pahlevi", "Shinta Bela",
  "Tegar Prakoso", "Ulfa Khoirunnisa", "Vania Larissa", "Wahyu Nugroho",
  "Yogi Prasetya", "Zahra Maulida", "Arif Rahman", "Bella Anggraini",
  "Candra Kirana", "Dina Amelia",
];

async function seed() {
  const connectionString =
    process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DIRECT_DATABASE_URL atau DATABASE_URL wajib disetel untuk seeding."
    );
  }

  console.log("Memulai seeding idempotent PILKETOS 2026 ke database Neon...");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    // =========================================================
    // 1. SEED AKUN ADMIN & PANITIA (BETTER AUTH)
    // =========================================================
    console.log("1/7 Seeding akun Super Admin dan Panitia...");
    const adminPassword =
      process.env.INITIAL_ADMIN_PASSWORD || "AdminPilketos2026!Secure";
    const hashedAdminPassword = await hashPassword(adminPassword);
    const hashedCommitteePassword = await hashPassword("PanitiaPilketos2026!");

    const adminUser = {
      id: "usr_super_admin_01",
      name: "Super Admin",
      email: process.env.INITIAL_ADMIN_EMAIL || "admin@smabojonggede.sch.id",
      emailVerified: true,
      username: process.env.INITIAL_ADMIN_USERNAME || "admin",
      displayUsername: "Super Admin",
      role: "super_admin" as const,
      banned: false,
    };

    const committeeUser = {
      id: "usr_committee_01",
      name: "Panitia Pelaksana",
      email: "panitia@smabojonggede.sch.id",
      emailVerified: true,
      username: "panitia",
      displayUsername: "Panitia",
      role: "committee" as const,
      banned: false,
    };

    await db
      .insert(schema.users)
      .values([adminUser, committeeUser])
      .onConflictDoNothing();

    await db
      .insert(schema.accounts)
      .values([
        {
          id: "acc_super_admin_01",
          accountId: adminUser.id,
          providerId: "credential",
          userId: adminUser.id,
          password: hashedAdminPassword,
        },
        {
          id: "acc_committee_01",
          accountId: committeeUser.id,
          providerId: "credential",
          userId: committeeUser.id,
          password: hashedCommitteePassword,
        },
      ])
      .onConflictDoNothing();

    // =========================================================
    // 2. SEED ELECTIONS & SETTINGS (PILKETOS 2026)
    // =========================================================
    console.log("2/7 Seeding data pemilihan PILKETOS 2026...");
    const electionId = "e1000000-0000-0000-0000-000000000001";

    await db
      .insert(schema.elections)
      .values({
        id: electionId,
        slug: "pilketos-2026",
        shortName: "PILKETOS 2026",
        title: "Pemilihan Ketua OSIS 2026",
        organizationName: "SMA Bojong Gede",
        description:
          "Kenali calon ketua sebelum menentukan pilihan. Suara kamu dijaga kerahasiaannya dan hanya bisa digunakan satu kali.",
        status: "open",
        startAt: new Date("2026-10-25T07:00:00Z"),
        endAt: new Date("2026-11-15T15:00:00Z"),
        isActive: true,
      })
      .onConflictDoNothing();

    await db
      .insert(schema.electionSettings)
      .values({
        id: "f1000000-0000-0000-0000-000000000001",
        electionId,
        idLabel: "NIS",
        groupLabel: "Rombel",
        gradeLabel: "Tingkat",
        majorLabel: "Jurusan",
        isResultPublic: false,
        logoUrl: "/images/logo-default.png",
        heroBannerUrl: "/images/hero-flag-ballot.jpg",
      })
      .onConflictDoNothing();

    // =========================================================
    // 3. SEED MASTER DATA: TINGKAT & JURUSAN
    // =========================================================
    console.log("3/7 Seeding tingkat kelas dan jurusan...");
    const gradeXId = "a1000000-0000-0000-0000-000000000001";
    const gradeXIId = "a1000000-0000-0000-0000-000000000002";
    const gradeXIIId = "a1000000-0000-0000-0000-000000000003";

    await db
      .insert(schema.gradeLevels)
      .values([
        { id: gradeXId, electionId, name: "Kelas X", sortOrder: 1 },
        { id: gradeXIId, electionId, name: "Kelas XI", sortOrder: 2 },
        { id: gradeXIIId, electionId, name: "Kelas XII", sortOrder: 3 },
      ])
      .onConflictDoNothing();

    const majorIPAId = "b1000000-0000-0000-0000-000000000001";
    const majorIPSId = "b1000000-0000-0000-0000-000000000002";

    await db
      .insert(schema.majors)
      .values([
        { id: majorIPAId, electionId, name: "IPA", code: "IPA", sortOrder: 1 },
        { id: majorIPSId, electionId, name: "IPS", code: "IPS", sortOrder: 2 },
      ])
      .onConflictDoNothing();

    // =========================================================
    // 4. SEED ROMBEL (VOTER GROUPS 1 s/d 7)
    // =========================================================
    console.log("4/7 Seeding Rombel 1 s/d 7...");
    const rombelIds = [
      "d1000000-0000-0000-0000-000000000001",
      "d1000000-0000-0000-0000-000000000002",
      "d1000000-0000-0000-0000-000000000003",
      "d1000000-0000-0000-0000-000000000004",
      "d1000000-0000-0000-0000-000000000005",
      "d1000000-0000-0000-0000-000000000006",
      "d1000000-0000-0000-0000-000000000007",
    ];

    const rombelData = rombelIds.map((id, index) => ({
      id,
      electionId,
      name: `Rombel ${index + 1}`,
      sortOrder: index + 1,
      gradeLevelId: index < 3 ? gradeXId : index < 5 ? gradeXIId : gradeXIIId,
      majorId: index % 2 === 0 ? majorIPAId : majorIPSId,
    }));

    await db
      .insert(schema.voterGroups)
      .values(rombelData)
      .onConflictDoNothing();

    // =========================================================
    // 5. SEED 4 KANDIDAT AKTIF
    // =========================================================
    console.log("5/7 Seeding 4 kandidat aktif...");
    const candidateIds: Record<number, string> = {
      1: "c1000000-0000-0000-0000-000000000001",
      2: "c1000000-0000-0000-0000-000000000002",
      3: "c1000000-0000-0000-0000-000000000003",
      4: "c1000000-0000-0000-0000-000000000004",
    };

    await db
      .insert(schema.candidates)
      .values([
        {
          id: candidateIds[1],
          electionId,
          candidateNumber: 1,
          name: "Raka Aditya Pratama",
          classOrUnit: "XI IPA",
          motto: "Bersama Bergerak, Bersama Bersinar",
          vision:
            "Mewujudkan OSIS SMA Bojong Gede yang inklusif, inovatif, dan berdaya saing tinggi dalam bidang akademik dan non-akademik.",
          missions: [
            "Meningkatkan partisipasi aktif siswa dalam setiap kegiatan sekolah",
            "Mengembangkan program kerja berbasis digital dan ramah lingkungan",
            "Mewadahi aspirasi seluruh warga sekolah secara transparan dan terbuka",
            "Mempererat kolaborasi antar-ekstrakurikuler dan organisasi internal sekolah",
          ],
          programs: [
            "Pekan Kreasi & Seni Pelajar",
            "Kotak Aspirasi Digital Siswa",
            "Bank Sampah & Gerakan Sekolah Hijau",
          ],
          supporters: [
            "Paskibra SMA Bojong Gede",
            "Klub Debat Bahasa Indonesia",
            "PMR Unit 01",
          ],
          photoUrl: null,
          themeColor: "red",
          isActive: true,
        },
        {
          id: candidateIds[2],
          electionId,
          candidateNumber: 2,
          name: "Alya Putri Maharani",
          classOrUnit: "XI IPS",
          motto: "Suara Kita, Aksi Nyata",
          vision:
            "Membangun karakter siswa yang berintegritas, mandiri, dan berbudaya gotong royong.",
          missions: [
            "Menguatkan kepedulian sosial melalui bakti masyarakat berkala",
            "Mendorong literasi digital dan kewirausahaan siswa",
            "Menciptakan ruang belajar yang suportif dan bebas perundungan",
          ],
          programs: [
            "OSIS Peduli Sesama",
            "Pelatihan Content Creator & Public Speaking",
            "Forum Diskusi Antar-Kelas",
          ],
          supporters: [
            "Pramuka Gugus Depan",
            "Ekstrakurikuler Teater",
            "Rohis & Rokris",
          ],
          photoUrl: null,
          themeColor: "green",
          isActive: true,
        },
        {
          id: candidateIds[3],
          electionId,
          candidateNumber: 3,
          name: "Dimas Bagaskara",
          classOrUnit: "XI IPA",
          motto: "Kreatif, Peduli, Berprestasi",
          vision:
            "Menjadikan SMA Bojong Gede sebagai barometer prestasi kepemudaan di tingkat regional.",
          missions: [
            "Fasilitasi pembinaan intensif kompetisi sains dan olahraga",
            "Digitalisasi administrasi dan dokumentasi kegiatan OSIS",
            "Membangun jejaring alumni untuk bimbingan karir dan kuliah",
          ],
          programs: [
            "Olimpiade Sekolah Terpadu",
            "Mentoring Kampus bersama Alumni",
            "Pojok Literasi Digital",
          ],
          supporters: [
            "Klub Sains & Robotik",
            "Klub Basket & Futsal",
            "English Club",
          ],
          photoUrl: null,
          themeColor: "blue",
          isActive: true,
        },
        {
          id: candidateIds[4],
          electionId,
          candidateNumber: 4,
          name: "Nadia Safira Rahman",
          classOrUnit: "XI IPS",
          motto: "Satu Langkah, Seribu Karya",
          vision:
            "OSIS yang adaptif, hangat, dan menjadi rumah kolaborasi bagi seluruh potensi siswa.",
          missions: [
            "Menyelenggarakan ruang apresiasi karya seni dan musik berkala",
            "Menjamin kebersihan dan kenyamanan fasilitas belajar bersama pihak sekolah",
            "Mengedepankan keterbukaan informasi program dan anggaran kegiatan",
          ],
          programs: [
            "Festival Band & Akustik Siswa",
            "Kampanye Mental Health Pelajar",
            "Market Day Kewirausahaan Mandiri",
          ],
          supporters: [
            "Paduan Suara",
            "Klub Fotografi & Jurnalistik",
            "Klub Seni Rupa",
          ],
          photoUrl: null,
          themeColor: "amber",
          isActive: true,
        },
      ])
      .onConflictDoNothing();

    // =========================================================
    // 6. SEED 76 DPT PEMILIH & SUARA AWAL (IDEMPOTENT)
    // =========================================================
    console.log("6/7 Seeding 76 data DPT dan suara awal...");
    const extraVoters = EXTRA_STUDENT_NAMES.map((name, idx) => ({
      nis: String(2425001 + idx),
      name,
      rombelIdx: idx % rombelIds.length,
      status: "not_voted" as const,
      token: undefined as string | undefined,
      votedCandidateNumber: undefined as number | undefined,
    }));

    const allSeedVoters = [...DEMO_VOTERS, ...extraVoters];
    if (allSeedVoters.length !== 76) {
      throw new Error(`Expected 76 DPT voters, got ${allSeedVoters.length}`);
    }

    const votersToInsert: Array<typeof schema.voters.$inferInsert> = [];
    const votesToInsert: Array<typeof schema.votes.$inferInsert> = [];

    for (const sv of allSeedVoters) {
      const voterId = deterministicUuid(`voter-${electionId}-${sv.nis}`);
      const rawToken = sv.token ?? deterministicVoterToken(sv.nis);
      const tokenHash = hashVoterToken(rawToken);
      const isVoted = sv.status === "voted";
      const tokenEncrypted = isVoted
        ? "[REDACTED]"
        : encryptVoterToken(rawToken);

      votersToInsert.push({
        id: voterId,
        electionId,
        groupId: rombelIds[sv.rombelIdx],
        voterIdentity: sv.nis,
        name: sv.name,
        tokenHash,
        tokenEncrypted,
        voterStatus: sv.status,
        hasVoted: isVoted,
        votedAt: isVoted ? new Date("2026-10-25T14:24:00Z") : null,
      });

      if (isVoted && sv.votedCandidateNumber) {
        votesToInsert.push({
          id: deterministicUuid(`vote-${electionId}-${sv.nis}`),
          electionId,
          candidateId: candidateIds[sv.votedCandidateNumber],
          createdAt: new Date("2026-10-25T14:24:00Z"),
        });
      }
    }

    await db
      .insert(schema.voters)
      .values(votersToInsert)
      .onConflictDoNothing();

    if (votesToInsert.length > 0) {
      await db
        .insert(schema.votes)
        .values(votesToInsert)
        .onConflictDoNothing();
    }

    // =========================================================
    // 7. SEED AUDIT LOG AWAL (IDEMPOTENT)
    // =========================================================
    console.log("7/7 Seeding audit log awal...");
    await db
      .insert(schema.auditLogs)
      .values([
        {
          id: deterministicUuid(`audit-${electionId}-1`),
          electionId,
          actorType: "admin",
          actorId: adminUser.id,
          actorName: adminUser.name,
          actorIdentity: `@${adminUser.username}`,
          action: "election_created",
          actionTitle: "Pemilihan dibuat",
          description: "Super Admin menginisialisasi pemilihan PILKETOS 2026",
          ipAddress: "::1",
          createdAt: new Date("2026-10-20T08:00:00Z"),
        },
        {
          id: deterministicUuid(`audit-${electionId}-2`),
          electionId,
          actorType: "admin",
          actorId: adminUser.id,
          actorName: adminUser.name,
          actorIdentity: `@${adminUser.username}`,
          action: "candidates_registered",
          actionTitle: "Kandidat didaftarkan",
          description: "4 pasang calon ketua OSIS berhasil didaftarkan ke sistem",
          ipAddress: "::1",
          createdAt: new Date("2026-10-21T09:30:00Z"),
        },
        {
          id: deterministicUuid(`audit-${electionId}-3`),
          electionId,
          actorType: "admin",
          actorId: committeeUser.id,
          actorName: committeeUser.name,
          actorIdentity: `@${committeeUser.username}`,
          action: "dpt_imported",
          actionTitle: "Impor DPT",
          description: "Panitia mengimpor 76 data DPT awal untuk 7 Rombel",
          ipAddress: "::1",
          createdAt: new Date("2026-10-22T10:15:00Z"),
        },
        {
          id: deterministicUuid(`audit-${electionId}-4`),
          electionId,
          actorType: "voter",
          actorId: deterministicUuid(`voter-${electionId}-2324004`),
          actorName: "Putri Ayu Lestari",
          actorIdentity: "NIS 2324004",
          action: "vote_cast",
          actionTitle: "Vote cast",
          description: "Pemilih telah memberikan suara",
          ipAddress: "::1",
          createdAt: new Date("2026-10-25T14:24:00Z"),
        },
        {
          id: deterministicUuid(`audit-${electionId}-5`),
          electionId,
          actorType: "voter",
          actorId: deterministicUuid(`voter-${electionId}-2324005`),
          actorName: "Budi Santoso",
          actorIdentity: "NIS 2324005",
          action: "vote_cast",
          actionTitle: "Vote cast",
          description: "Pemilih telah memberikan suara",
          ipAddress: "::1",
          createdAt: new Date("2026-10-25T14:24:00Z"),
        },
      ])
      .onConflictDoNothing();

    console.log("✓ Seeding PILKETOS 2026 berhasil diselesaikan (76 DPT, 4 Kandidat, 2 Suara, 5 Log)!");
  } catch (error) {
    console.error("Gagal melakukan seeding:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
