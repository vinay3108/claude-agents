"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImportJob } from "@/domain/entities/ImportJob";
import { agentFetch } from "./useAgentApi";
export const useImportJobs = () =>
  useQuery({
    queryKey: ["imports"],
    queryFn: () => agentFetch<ImportJob[]>("/api/agent/imports"),
    refetchInterval: (query) =>
      query.state.data?.some((job) =>
        ["queued", "normalizing", "extracting"].includes(job.status),
      )
        ? 2000
        : false,
  });
export const useStartImport = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: FormData) =>
      agentFetch<ImportJob[]>("/api/agent/imports", { method: "POST", body }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["imports"] }),
  });
};
export const useUndoImport = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      agentFetch(`/api/agent/imports/${id}/undo`, { method: "POST" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["imports"] });
      void client.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });
};
