import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateElectionScopes } from "@/lib/query-keys";

describe("Empirical Challenge: Query Invalidation & Scope Synchronization", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10_000,
        },
      },
    });
  });

  it("Updating settings invalidates both dashboard and settings queries for UUID and active alias", async () => {
    const electionId = "e4e94d80-8785-48cd-bf89-4e78a63e9f45";

    // Seed cached queries
    queryClient.setQueryData(queryKeys.election.dashboard(electionId), { id: electionId });
    queryClient.setQueryData(queryKeys.election.dashboard("active"), { id: "active" });
    queryClient.setQueryData(queryKeys.election.settings(electionId), { id: electionId });
    queryClient.setQueryData(queryKeys.election.settings("active"), { id: "active" });

    expect(queryClient.getQueryState(queryKeys.election.dashboard(electionId))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(queryKeys.election.dashboard("active"))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(queryKeys.election.settings(electionId))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(queryKeys.election.settings("active"))?.isInvalidated).toBe(false);

    // Run settings invalidation with electionId = "active"
    await invalidateElectionScopes(queryClient, "active", ["settings", "dashboard"]);

    expect(queryClient.getQueryState(queryKeys.election.dashboard(electionId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.election.dashboard("active"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.election.settings(electionId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.election.settings("active"))?.isInvalidated).toBe(true);
  });

  it("Mutating candidate data with UUID invalidates queries for both UUID and 'active' alias", async () => {
    const electionId = "e4e94d80-8785-48cd-bf89-4e78a63e9f45";

    queryClient.setQueryData(queryKeys.candidates.all(electionId), [{ id: "c1" }]);
    queryClient.setQueryData(queryKeys.candidates.all("active"), [{ id: "c1" }]);
    queryClient.setQueryData(queryKeys.election.dashboard(electionId), { id: electionId });
    queryClient.setQueryData(queryKeys.election.dashboard("active"), { id: "active" });

    // Invalidate with UUID
    await invalidateElectionScopes(queryClient, electionId, ["candidates", "dashboard", "results", "logs"]);

    expect(queryClient.getQueryState(queryKeys.candidates.all(electionId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.candidates.all("active"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.election.dashboard(electionId))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.election.dashboard("active"))?.isInvalidated).toBe(true);
  });

  it("Mutating voters with 'active' invalidates queries for both 'active' and UUID", async () => {
    const electionId = "e4e94d80-8785-48cd-bf89-4e78a63e9f45";

    queryClient.setQueryData(queryKeys.voters.all(electionId), [{ id: "v1" }]);
    queryClient.setQueryData(queryKeys.voters.all("active"), [{ id: "v1" }]);
    queryClient.setQueryData(queryKeys.election.dashboard(electionId), { id: electionId });
    queryClient.setQueryData(queryKeys.election.dashboard("active"), { id: "active" });

    // When mutating from /admin/voters (which passes electionId="active")
    await invalidateElectionScopes(queryClient, "active", ["voters", "dashboard", "results", "logs"]);

    // The 'active' queries are invalidated
    expect(queryClient.getQueryState(queryKeys.voters.all("active"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.election.dashboard("active"))?.isInvalidated).toBe(true);

    // What about the UUID queries?
    const uuidVotersState = queryClient.getQueryState(queryKeys.voters.all(electionId));
    const uuidDashboardState = queryClient.getQueryState(queryKeys.election.dashboard(electionId));

    // Both voters and dashboard queries for the UUID are now properly invalidated
    expect(uuidVotersState?.isInvalidated).toBe(true);
    expect(uuidDashboardState?.isInvalidated).toBe(true);
  });
});
