"use client";
import { Button } from "@/components/ui/button";
import type { Insight } from "@/domain/entities/Insight";
export function InsightList({
  insights,
  onArchive,
}: {
  readonly insights: readonly Insight[];
  readonly onArchive: (id: string) => void;
}) {
  if (!insights.length)
    return (
      <p className="text-sm text-muted-foreground">No coaching insights yet.</p>
    );
  return (
    <ul className="divide-y rounded-lg border">
      {insights.map((insight) => (
        <li key={insight.id} className="flex gap-2 p-3 text-sm">
          <div className="flex-1">
            <p>{insight.text}</p>
            <p className="text-xs text-muted-foreground">
              Evidence: {insight.evidence}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onArchive(insight.id)}
          >
            Forget
          </Button>
        </li>
      ))}
    </ul>
  );
}
