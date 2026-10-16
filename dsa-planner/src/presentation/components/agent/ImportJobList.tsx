"use client";
import { Button } from "@/components/ui/button";
import type { ImportJob } from "@/domain/entities/ImportJob";
export function ImportJobList({
  jobs,
  onUndo,
}: {
  readonly jobs: readonly ImportJob[];
  readonly onUndo: (id: string) => void;
}) {
  if (!jobs.length)
    return <p className="text-sm text-muted-foreground">No imports yet.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {jobs.map((job) => (
        <li key={job.id} className="flex flex-wrap gap-2 p-3 text-sm">
          <span className="flex-1 font-medium">
            {job.filename || "Pasted notes"}
          </span>
          <span>
            {job.chunksDone} / {job.chunksTotal} parts · {job.itemsSaved} saved
          </span>
          <span>{job.status}</span>
          {job.status === "done" && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Undo import ${job.filename || "Pasted notes"}`}
              onClick={() => onUndo(job.id)}
            >
              Undo
            </Button>
          )}
          {job.error && <p className="w-full text-destructive">{job.error}</p>}
        </li>
      ))}
    </ul>
  );
}
