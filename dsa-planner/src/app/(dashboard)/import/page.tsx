"use client";
import { PageHeader } from "@/presentation/components/layout/PageHeader";
import { ImportForm } from "@/presentation/components/agent/ImportForm";
import { ImportJobList } from "@/presentation/components/agent/ImportJobList";
import { useImportJobs, useUndoImport } from "@/presentation/hooks/useImports";
export default function ImportPage() {
  const jobs = useImportJobs();
  const undo = useUndoImport();
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="// memory · import"
        title="Import"
        description="Give the agent notes to sort into knowledge."
      />
      <ImportForm />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent imports</h2>
        <ImportJobList
          jobs={jobs.data ?? []}
          onUndo={(id) => undo.mutate(id)}
        />
      </section>
    </div>
  );
}
