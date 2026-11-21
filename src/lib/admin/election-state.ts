export interface ElectionScheduleInput {
  status: string;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
}

/**
 * Memeriksa apakah suatu pemilihan secara faktual sedang berlangsung secara waktu nyata.
 * Pemilihan dianggap sedang berlangsung jika:
 * 1. Status resminya adalah 'open'.
 * 2. Waktu selesai (endAt) belum terlewati (now <= endAt). Jika endAt null, dianggap masih berlangsung.
 */
export function isElectionOngoing(
  election?: ElectionScheduleInput | null,
  referenceDate = new Date()
): boolean {
  if (!election || election.status !== "open") {
    return false;
  }

  if (!election.endAt) {
    return true;
  }

  const endTime = new Date(election.endAt).getTime();
  if (isNaN(endTime)) {
    return true;
  }

  return referenceDate.getTime() <= endTime;
}

/**
 * Memeriksa apakah waktu jadwal pemilihan telah kedaluwarsa (berakhir di masa lalu),
 * namun status administratifnya masih bernilai 'open'.
 */
export function isElectionScheduleExpired(
  election?: ElectionScheduleInput | null,
  referenceDate = new Date()
): boolean {
  if (!election || election.status !== "open") {
    return false;
  }

  if (!election.endAt) {
    return false;
  }

  const endTime = new Date(election.endAt).getTime();
  if (isNaN(endTime)) {
    return false;
  }

  return referenceDate.getTime() > endTime;
}
