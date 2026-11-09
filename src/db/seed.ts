import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { hashPassword } from "better-auth/crypto";
import * as schema from "./schema";
import {
  generateVoterToken,
  hashVoterToken,
  encryptVoterToken,
} from "../lib/crypto/token";

neonConfig.webSocketConstructor = ws;

async function seed() {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_DATABASE_URL atau DATABASE_URL wajib disetel untuk seeding.");
  }

  console.log("Memulai seeding data awal PILKETOS 2026 ke database...");
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    // =========================================================
    // 1. SEED AKUN ADMIN & PANITIA (BETTER AUTH)
    // =========================================================
    console.log("Seeding akun Admin dan Panitia...");
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "AdminPilketos2026!Secure";
    const hashedAdminPassword = await hashPassword(adminPassword);
    const hashedPanitiaPassword = await hashPassword("PanitiaPilketos2026!");

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

    await db.insert(schema.users).values([adminUser, committeeUser]).onConflictDoNothing();

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
          password: hashedPanitiaPassword,
        },
      ])
      .onConflictDoNothing();

    // =========================================================
    // 2. SEED ELECTIONS & SETTINGS (PILKETOS 2026)
    // =========================================================
    console.log("Seeding data Pemilihan PILKETOS 2026...");
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
    console.log("Seeding data Tingkat Kelas dan Jurusan...");
    const gradeXId = "g1000000-0000-0000-0000-000000000001";
    const gradeXIId = "g1000000-0000-0000-0000-000000000002";
    const gradeXIIId = "g1000000-0000-0000-0000-000000000003";

    await db
      .insert(schema.gradeLevels)
      .values([
        { id: gradeXId, electionId, name: "Kelas X", sortOrder: 1 },
        { id: gradeXIId, electionId, name: "Kelas XI", sortOrder: 2 },
        { id: gradeXIIId, electionId, name: "Kelas XII", sortOrder: 3 },
      ])
      .onConflictDoNothing();

    const majorIPAId = "m1000000-0000-0000-0000-000000000001";
    const majorIPSId = "m1000000-0000-0000-0000-000000000002";

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
    console.log("Seeding data Rombel 1 s/d 7...");
    const rombelIds = [
      "r1000000-0000-0000-0000-000000000001",
      "r1000000-0000-0000-0000-000000000002",
      "r1000000-0000-0000-0000-000000000003",
      "r1000000-0000-0000-0000-000000000004",
      "r1000000-0000-0000-0000-000000000005",
      "r1000000-0000-0000-0000-000000000006",
      "r1000000-0000-0000-0000-000000000007",
    ];

    const rombelData = rombelIds.map((id, index) => ({
      id,
      electionId,
      name: `Rombel ${index + 1}`,
      sortOrder: index + 1,
      gradeLevelId: index < 3 ? gradeXId : index < 5 ? gradeXIId : gradeXIIId,
      majorId: index % 2 === 0 ? majorIPAId : majorIPSId,
    }));

    await db.insert(schema.voterGroups).values(rombelData).onConflictDoNothing();

    // =========================================================
    // 5. SEED KANDIDAT (4 PASANGAN CALON KETUA OSIS)
    // =========================================================
    console.log("Seeding 4 Kandidat Ketua OSIS...");
    const candidate1Id = "c1000000-0000-0000-0000-000000000001";
    const candidate2Id = "c1000000-0000-0000-0000-000000000002";
    const candidate3Id = "c1000000-0000-0000-0000-000000000003";
    const candidate4Id = "c1000000-0000-0000-0000-000000000004";

    const candidateData = [
      {
        id: candidate1Id,
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
        photoUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDwNeqSs7iHKSD_ggpALw4dlbaGz2Xtt030aWJ3PEnN37wKv8VdkXHl_TAbyJutS-kfvj1S8XAhVzRj1J6ePWydM4RsrEvL8Gs28eklM01_PWfTsbwKXym4AxBd-ViSy5OwPHdJMgvDeYetSj-6LdNEcta5atS2Wqen38EBfIPsyX6o_erO6Wou7qTuB9g-KqUyv9zYMYNdh5aPLK0vJDzwrtIAFYfOZkBNEhPJXsWinBB-CSZbKCCz",
        themeColor: "red" as const,
        isActive: true,
      },
      {
        id: candidate2Id,
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
        photoUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDwNeqSs7iHKSD_ggpALw4dlbaGz2Xtt030aWJ3PEnN37wKv8VdkXHl_TAbyJutS-kfvj1S8XAhVzRj1J6ePWydM4RsrEvL8Gs28eklM01_PWfTsbwKXym4AxBd-ViSy5OwPHdJMgvDeYetSj-6LdNEcta5atS2Wqen38EBfIPsyX6o_erO6Wou7qTuB9g-KqUyv9zYMYNdh5aPLK0vJDzwrtIAFYfOZkBNEhPJXsWinBB-CSZbKCCz",
        themeColor: "green" as const,
        isActive: true,
      },
      {
        id: candidate3Id,
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
        photoUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDwNeqSs7iHKSD_ggpALw4dlbaGz2Xtt030aWJ3PEnN37wKv8VdkXHl_TAbyJutS-kfvj1S8XAhVzRj1J6ePWydM4RsrEvL8Gs28eklM01_PWfTsbwKXym4AxBd-ViSy5OwPHdJMgvDeYetSj-6LdNEcta5atS2Wqen38EBfIPsyX6o_erO6Wou7qTuB9g-KqUyv9zYMYNdh5aPLK0vJDzwrtIAFYfOZkBNEhPJXsWinBB-CSZbKCCz",
        themeColor: "blue" as const,
        isActive: true,
      },
      {
        id: candidate4Id,
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
        photoUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDwNeqSs7iHKSD_ggpALw4dlbaGz2Xtt030aWJ3PEnN37wKv8VdkXHl_TAbyJutS-kfvj1S8XAhVzRj1J6ePWydM4RsrEvL8Gs28eklM01_PWfTsbwKXym4AxBd-ViSy5OwPHdJMgvDeYetSj-6LdNEcta5atS2Wqen38EBfIPsyX6o_erO6Wou7qTuB9g-KqUyv9zYMYNdh5aPLK0vJDzwrtIAFYfOZkBNEhPJXsWinBB-CSZbKCCz",
        themeColor: "amber" as const,
        isActive: true,
      },
    ];

    await db.insert(schema.candidates).values(candidateData).onConflictDoNothing();

    // =========================================================
    // 6. SEED SAMPEL DPT (DAFTAR PEMILIH TETAP CONTOH)
    // =========================================================
    console.log("Seeding data contoh pemilih DPT...");
    const sampleVoterNames = [
      { nis: "2324001", name: "Aditya Pratama", rombelIdx: 0, status: "not_voted" as const },
      { nis: "2324002", name: "Ahmad Fauzi", rombelIdx: 0, status: "not_voted" as const },
      { nis: "2324003", name: "Dewi Sartika", rombelIdx: 0, status: "not_voted" as const },
      { nis: "2324004", name: "Putri Ayu Lestari", rombelIdx: 1, status: "voted" as const, votedCand: candidate1Id },
      { nis: "2324005", name: "Budi Santoso", rombelIdx: 1, status: "voted" as const, votedCand: candidate1Id },
      { nis: "2324006", name: "Citra Lestari", rombelIdx: 1, status: "not_voted" as const },
      { nis: "2324007", name: "Doni Prasetyo", rombelIdx: 2, status: "voted" as const, votedCand: candidate2Id },
      { nis: "2324008", name: "Eka Rahmawati", rombelIdx: 2, status: "not_voted" as const },
      { nis: "2324009", name: "Fajar Nugraha", rombelIdx: 2, status: "voted" as const, votedCand: candidate3Id },
      { nis: "2324010", name: "Gita Permata", rombelIdx: 2, status: "not_voted" as const },
      { nis: "2324011", name: "Anisa Rahmawati", rombelIdx: 3, status: "logged_in" as const },
      { nis: "2324012", name: "Hendra Wijaya", rombelIdx: 3, status: "voted" as const, votedCand: candidate4Id },
      { nis: "2324013", name: "Indah Kusumawati", rombelIdx: 3, status: "not_voted" as const },
      { nis: "2324014", name: "Joko Supriyanto", rombelIdx: 4, status: "not_voted" as const },
      { nis: "2324015", name: "Kartika Sari", rombelIdx: 4, status: "voted" as const, votedCand: candidate1Id },
      { nis: "2324016", name: "Lukman Hakim", rombelIdx: 4, status: "not_voted" as const },
      { nis: "2324017", name: "Mega Utami", rombelIdx: 5, status: "not_voted" as const },
      { nis: "2324018", name: "Naufal Ramadhan", rombelIdx: 5, status: "voted" as const, votedCand: candidate2Id },
      { nis: "2324019", name: "Olivia Maharani", rombelIdx: 5, status: "not_voted" as const },
      { nis: "2024001", name: "Deni Subekti", rombelIdx: 6, status: "not_voted" as const },
      { nis: "2024002", name: "Rian Hidayat", rombelIdx: 6, status: "voted" as const, votedCand: candidate3Id },
      { nis: "2024003", name: "Siti Nurhaliza", rombelIdx: 6, status: "not_voted" as const },
    ];

    const votersToInsert = [];
    const votesToInsert = [];

    for (const sv of sampleVoterNames) {
      const rawToken = generateVoterToken(8);
      const tokenHash = hashVoterToken(rawToken);
      const isVoted = sv.status === "voted";
      // Jika sudah memilih, tokenEncrypted di-redact sesuai aturan keamanan
      const tokenEncrypted = isVoted ? "[REDACTED]" : encryptVoterToken(rawToken);

      votersToInsert.push({
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

      if (isVoted && sv.votedCand) {
        votesToInsert.push({
          electionId,
          candidateId: sv.votedCand,
          createdAt: new Date("2026-10-25T14:24:00Z"),
        });
      }
    }

    await db.insert(schema.voters).values(votersToInsert).onConflictDoNothing();

    if (votesToInsert.length > 0) {
      await db.insert(schema.votes).values(votesToInsert);
    }

    // =========================================================
    // 7. SEED AUDIT LOG AWAL
    // =========================================================
    console.log("Seeding audit log awal...");
    await db
      .insert(schema.auditLogs)
      .values([
        {
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
          electionId,
          actorType: "admin",
          actorId: committeeUser.id,
          actorName: committeeUser.name,
          actorIdentity: `@${committeeUser.username}`,
          action: "dpt_imported",
          actionTitle: "Impor DPT",
          description: "Panitia mengimpor data DPT contoh untuk 7 Rombel",
          ipAddress: "::1",
          createdAt: new Date("2026-10-22T10:15:00Z"),
        },
        {
          electionId,
          actorType: "voter",
          actorId: null,
          actorName: "Putri Ayu Lestari",
          actorIdentity: "NIS 2324004",
          action: "vote_cast",
          actionTitle: "Vote cast",
          description: "Pemilih telah memberikan suara",
          ipAddress: "::1",
          createdAt: new Date("2026-10-25T14:24:00Z"),
        },
      ])
      .onConflictDoNothing();

    console.log("✓ Seeding PILKETOS 2026 berhasil diselesaikan!");
  } catch (error) {
    console.error("Gagal melakukan seeding:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
