"use client";
import { PageHeader } from "@/presentation/components/layout/PageHeader";
import { ProfileFactList } from "@/presentation/components/agent/ProfileFactList";
import { InsightList } from "@/presentation/components/agent/InsightList";
import { RunList } from "@/presentation/components/agent/RunList";
import {
  useAgentRuns,
  useArchiveInsight,
  useFactAction,
  useInsights,
  useProfileFacts,
  useUndoRun,
} from "@/presentation/hooks/useMemory";
export default function MemoryPage() {
  const facts = useProfileFacts();
  const insights = useInsights();
  const runs = useAgentRuns();
  const factAction = useFactAction();
  const archive = useArchiveInsight();
  const undo = useUndoRun();
  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        eyebrow="// memory"
        title="Memory"
        description="Confirm facts, forget insights, and undo agent runs."
      />
      <section>
        <h2 className="mb-2 font-semibold">Profile</h2>
        <ProfileFactList
          facts={facts.data ?? []}
          onAction={(id, body) => factAction.mutate({ id, body })}
        />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Insights</h2>
        <InsightList
          insights={insights.data ?? []}
          onArchive={(id) => archive.mutate(id)}
        />
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Agent activity</h2>
        <RunList runs={runs.data ?? []} onUndo={(id) => undo.mutate(id)} />
      </section>
    </div>
  );
}
