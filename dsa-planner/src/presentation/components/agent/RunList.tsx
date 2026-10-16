"use client";
import { Button } from "@/components/ui/button";
import type { AgentRun } from "@/domain/entities/AgentRun";
export function RunList({
  runs,
  onUndo,
}: {
  readonly runs: readonly AgentRun[];
  readonly onUndo: (id: string) => void;
}) {
  if (!runs.length)
    return (
      <p className="text-sm text-muted-foreground">No agent activity yet.</p>
    );
  return (
    <ul className="divide-y rounded-lg border">
      {runs.map((run) => (
        <li key={run.id} className="flex flex-wrap gap-2 p-3 text-sm">
          <span className="flex-1">{run.inputSummary || run.surface}</span>
          <span>
            {run.toolCalls} tools · {run.status}
          </span>
          {["succeeded", "aborted", "failed"].includes(run.status) && (
            <Button size="sm" variant="ghost" onClick={() => onUndo(run.id)}>
              Undo
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
