import type { QueryClient } from "@tanstack/react-query";

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

/**
 * Returns scope aliases for query invalidation.
 * If electionId is a UUID, returns [electionId, "active"].
 * If electionId is "active" or empty, returns ["active"].
 */
export function getElectionScopeAliases(electionId?: string): string[] {
  if (!electionId || electionId === "active") {
    return ["active"];
  }
  return [electionId, "active"];
}

export type ElectionScopeType =
  | "dashboard"
  | "results"
  | "candidates"
  | "voters"
  | "master"
  | "settings"
  | "logs";

/**
 * Concurrently invalidates query scopes for both the election UUID and the "active" alias.
 * Ensures cross-page state synchronization between views using UUIDs and views using "active".
 */
export async function invalidateElectionScopes(
  queryClient: QueryClient,
  electionId: string,
  scopes: ElectionScopeType[]
): Promise<void> {
  const aliases = getElectionScopeAliases(electionId);
  const tasks: Promise<unknown>[] = [];

  for (const alias of aliases) {
    if (scopes.includes("dashboard")) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.election.dashboard(alias),
        })
      );
    }
    if (scopes.includes("results")) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.election.results(alias),
        })
      );
    }
    if (scopes.includes("candidates")) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.candidates.all(alias),
        })
      );
    }
    if (scopes.includes("voters")) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.voters.all(alias),
        })
      );
    }
    if (scopes.includes("master")) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.master.all(alias),
        })
      );
    }
    if (scopes.includes("settings")) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.election.settings(alias),
        })
      );
    }
    if (scopes.includes("logs")) {
      tasks.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.logs.all(alias),
        })
      );
    }
  }

  // Root prefix invalidation for all voter queries across both UUID and "active"
  if (scopes.includes("voters")) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: ["voters"],
      })
    );
  }

  // When mutating under "active" alias, invalidate all election queries (dashboard/results)
  if (
    scopes.includes("settings") ||
    (aliases.length === 1 &&
      (scopes.includes("dashboard") || scopes.includes("results")))
  ) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.election.all,
      })
    );
  }

  await Promise.all(tasks);
}
