export type AdminRole = "super_admin" | "committee";

export type ElectionStatus = "draft" | "open" | "closed" | "archived";

export type VoterStatus = "not_voted" | "logged_in" | "voted";

export type ActorType = "admin" | "voter" | "system";

export type CandidateTheme = "red" | "green" | "blue" | "amber";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ElectionSettingsDTO {
  idLabel: string;
  groupLabel: string;
  gradeLabel: string;
  majorLabel: string;
  isResultPublic: boolean;
  logoUrl: string | null;
  heroBannerUrl: string | null;
}

export interface CandidateDTO {
  id: string;
  electionId: string;
  candidateNumber: number;
  name: string;
  classOrUnit: string;
  motto: string;
  vision: string;
  missions: string[];
  programs: string[];
  supporters: string[];
  photoUrl: string | null;
  themeColor: CandidateTheme;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ElectionPublicDTO {
  id: string;
  slug: string;
  shortName: string;
  title: string;
  organizationName: string;
  description: string | null;
  status: ElectionStatus;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  settings: ElectionSettingsDTO;
  candidateCount: number;
  candidates: CandidateDTO[];
}

export interface VoterSessionDTO {
  id: string;
  electionId: string;
  name: string;
  voterIdentity: string;
  groupId: string;
  groupName: string;
  hasVoted: boolean;
  votedAt: string | null;
}

export interface VoterDTO {
  id: string;
  electionId: string;
  groupId: string;
  groupName: string;
  gradeLevelId: string | null;
  gradeName: string | null;
  majorId: string | null;
  majorName: string | null;
  voterIdentity: string;
  name: string;
  token: string | null;
  voterStatus: VoterStatus;
  hasVoted: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  votedAt: string | null;
  createdAt?: string;
}

export interface VoterSummaryDTO {
  totalVoters: number;
  votesCast: number;
  notVoted: number;
  turnoutPercentage: number;
}

export interface VoterListResponseDTO {
  voters: VoterDTO[];
  summary: VoterSummaryDTO;
  meta: PaginationMeta;
}

export interface GradeLevelDTO {
  id: string;
  electionId: string;
  name: string;
  sortOrder: number;
  groupCount?: number;
}

export interface MajorDTO {
  id: string;
  electionId: string;
  name: string;
  code: string | null;
  sortOrder: number;
  groupCount?: number;
}

export interface VoterGroupDTO {
  id: string;
  electionId: string;
  gradeLevelId: string | null;
  gradeName: string | null;
  majorId: string | null;
  majorName: string | null;
  name: string;
  sortOrder: number;
  voterCount?: number;
}

export interface MasterDataDTO {
  gradeLevels: GradeLevelDTO[];
  majors: MajorDTO[];
  voterGroups: VoterGroupDTO[];
}

export interface GroupParticipationDTO {
  groupId: string;
  groupName: string;
  gradeName: string | null;
  majorName: string | null;
  totalMembers: number;
  votedMembers: number;
  percentage: number;
}

export interface ElectionReadinessDTO {
  isReady: boolean;
  checks: {
    hasMinTwoActiveCandidates: boolean;
    hasVotersRegistered: boolean;
    hasScheduleConfigured: boolean;
    hasOrganizationName: boolean;
  };
}

export interface AuditLogDTO {
  id: string;
  electionId: string;
  actorType: ActorType;
  actorId: string | null;
  actorName: string;
  actorIdentity: string;
  action: string;
  actionTitle: string;
  description: string;
  ipAddress: string;
  createdAt: string;
}

export interface AuditLogSummaryDTO {
  totalLogs: number;
  adminActivities: number;
  voterLoginSuccess: number;
  voterLoginFailed: number;
}

export interface AuditLogListResponseDTO {
  logs: AuditLogDTO[];
  summary: AuditLogSummaryDTO;
  meta: PaginationMeta;
}

export interface DashboardStatsDTO {
  election: {
    id: string;
    shortName: string;
    title: string;
    organizationName: string;
    status: ElectionStatus;
    startAt: string | null;
    endAt: string | null;
    settings: ElectionSettingsDTO;
  };
  summary: {
    activeCandidates: number;
    totalVoters: number;
    votesCast: number;
    notVoted: number;
    turnoutPercentage: number;
  };
  groupParticipation: GroupParticipationDTO[];
  readiness: ElectionReadinessDTO;
  recentActivities: AuditLogDTO[];
  lastUpdatedAt: string;
}

export interface CandidateResultDTO {
  id: string;
  candidateNumber: number;
  name: string;
  classOrUnit: string;
  photoUrl: string | null;
  themeColor: CandidateTheme;
  voteCount: number;
  percentage: number;
  rank: number;
}

export interface ElectionResultsDTO {
  election: {
    id: string;
    shortName?: string;
    title: string;
    organizationName: string;
    status: ElectionStatus;
    startAt: string | null;
    endAt: string | null;
  };
  summary: {
    totalVoters: number;
    votesCast: number;
    notVoted: number;
    turnoutPercentage: number;
  };
  leadingCandidate: {
    candidateNumber: number;
    name: string;
    isTie: boolean;
  } | null;
  candidates: CandidateResultDTO[];
  groupParticipation: GroupParticipationDTO[];
  lastUpdatedAt: string;
}

export interface VoterFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | VoterStatus;
  groupId?: string;
  gradeLevelId?: string;
  majorId?: string;
}

export interface AuditLogFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  actorType?: "all" | ActorType;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}
