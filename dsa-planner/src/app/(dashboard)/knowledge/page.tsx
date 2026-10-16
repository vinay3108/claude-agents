"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/presentation/components/layout/PageHeader";
import { KnowledgeList } from "@/presentation/components/agent/KnowledgeList";
import { useKnowledgeSearch } from "@/presentation/hooks/useKnowledge";
export default function KnowledgePage() {
  const [q, setQ] = useState("");
  const query = useKnowledgeSearch({ q });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="// memory · knowledge"
        title="Knowledge"
        description="Your notes and what the agent saved."
      />
      <Input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search knowledge…"
        aria-label="Search knowledge"
      />
      {query.error ? (
        <p className="text-destructive">{query.error.message}</p>
      ) : (
        <KnowledgeList items={query.data ?? []} />
      )}
    </div>
  );
}
