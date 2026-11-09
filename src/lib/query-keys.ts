export const queryKeys = {
  election: {
    all: ["election"] as const,
    active: () => [...queryKeys.election.all, "active"] as const,
    detail: (id: string) => [...queryKeys.election.all, "detail", id] as const,
    settings: (electionId: string) => [...queryKeys.election.all, "settings", electionId] as const,
    readiness: (electionId: string) => [...queryKeys.election.all, "readiness", electionId] as const,
  },
  settings: {
    all: ["settings"] as const,
  },
  candidates: {
    all: ["candidates"] as const,
    list: (electionId: string) => [...queryKeys.candidates.all, "list", electionId] as const,
    detail: (id: string) => [...queryKeys.candidates.all, "detail", id] as const,
  },
  voters: {
    all: ["voters"] as const,
    list: (electionId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.voters.all, "list", electionId, filters] as const,
    detail: (id: string) => [...queryKeys.voters.all, "detail", id] as const,
    stats: (electionId: string) => [...queryKeys.voters.all, "stats", electionId] as const,
  },
  results: {
    all: ["results"] as const,
    live: (electionId: string) => [...queryKeys.results.all, "live", electionId] as const,
  },
  logs: {
    all: ["logs"] as const,
    list: (electionId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.logs.all, "list", electionId, filters] as const,
    stats: (electionId: string) => [...queryKeys.logs.all, "stats", electionId] as const,
  },
  master: {
    all: ["master"] as const,
    grades: (electionId: string) => [...queryKeys.master.all, "grades", electionId] as const,
    majors: (electionId: string) => [...queryKeys.master.all, "majors", electionId] as const,
    groups: (electionId: string) => [...queryKeys.master.all, "groups", electionId] as const,
  },
  adminUsers: {
    all: ["admin", "users"] as const,
  },
  admin: {
    users: () => ["admin", "users"] as const,
    dashboard: (electionId: string) => ["admin", "dashboard", electionId] as const,
  },
};
