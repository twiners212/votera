export const queryKeys = {
  election: {
    all: ["election"] as const,
    active: () => ["election", "active"] as const,
    settings: (electionId: string) => ["election", electionId, "settings"] as const,
    dashboard: (electionId: string) => ["election", electionId, "dashboard"] as const,
    results: (electionId: string) => ["election", electionId, "results"] as const,
  },
  candidates: {
    all: (electionId: string) => ["candidates", electionId] as const,
    detail: (electionId: string, id: string) => ["candidates", electionId, id] as const,
  },
  voters: {
    all: (electionId: string) => ["voters", electionId] as const,
    list: (electionId: string, filters: Record<string, unknown>) =>
      ["voters", electionId, "list", filters] as const,
  },
  logs: {
    all: (electionId: string) => ["logs", electionId] as const,
    list: (electionId: string, filters: Record<string, unknown>) =>
      ["logs", electionId, "list", filters] as const,
  },
  master: {
    all: (electionId: string) => ["master", electionId] as const,
    grades: (electionId: string) => ["master", electionId, "grades"] as const,
    majors: (electionId: string) => ["master", electionId, "majors"] as const,
    groups: (electionId: string) => ["master", electionId, "groups"] as const,
  },
  admin: {
    users: () => ["admin", "users"] as const,
  },
};
