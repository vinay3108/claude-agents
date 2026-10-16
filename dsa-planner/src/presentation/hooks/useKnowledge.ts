"use client";
import { useQuery } from "@tanstack/react-query";
import type {
  KnowledgeItem,
  KnowledgeKind,
} from "@/domain/entities/KnowledgeItem";
import { agentFetch } from "./useAgentApi";
export const useKnowledgeSearch = ({
  q,
  kind,
}: {
  q: string;
  kind?: KnowledgeKind;
}) => {
  const params = new URLSearchParams({
    ...(q ? { q } : {}),
    ...(kind ? { kind } : {}),
  });
  return useQuery({
    queryKey: ["knowledge", q, kind ?? ""],
    queryFn: () =>
      agentFetch<KnowledgeItem[]>(`/api/agent/knowledge?${params}`),
  });
};
