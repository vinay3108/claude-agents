"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentRun } from "@/domain/entities/AgentRun";
import type { Insight } from "@/domain/entities/Insight";
import type { ProfileFact } from "@/domain/entities/ProfileFact";
import { agentFetch } from "./useAgentApi";
export const useProfileFacts = () =>
  useQuery({
    queryKey: ["facts"],
    queryFn: () => agentFetch<ProfileFact[]>("/api/agent/profile-facts"),
  });
export const useInsights = () =>
  useQuery({
    queryKey: ["insights"],
    queryFn: () => agentFetch<Insight[]>("/api/agent/insights"),
  });
export const useAgentRuns = () =>
  useQuery({
    queryKey: ["runs"],
    queryFn: () => agentFetch<AgentRun[]>("/api/agent/runs"),
  });
const useInvalidating = <T>(
  fn: (input: T) => Promise<unknown>,
  keys: string[],
) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      keys.forEach((key) => void client.invalidateQueries({ queryKey: [key] })),
  });
};
export const useFactAction = () =>
  useInvalidating(
    ({ id, body }: { id: string; body: unknown }) =>
      agentFetch(`/api/agent/profile-facts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    ["facts"],
  );
export const useArchiveInsight = () =>
  useInvalidating(
    (id: string) =>
      agentFetch(`/api/agent/insights/${id}/archive`, { method: "POST" }),
    ["insights"],
  );
export const useUndoRun = () =>
  useInvalidating(
    (id: string) =>
      agentFetch(`/api/agent/runs/${id}/undo`, { method: "POST" }),
    ["runs", "knowledge", "facts", "insights"],
  );
