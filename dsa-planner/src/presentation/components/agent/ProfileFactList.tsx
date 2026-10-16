"use client";
import { Button } from "@/components/ui/button";
import type { ProfileFact } from "@/domain/entities/ProfileFact";
export function ProfileFactList({
  facts,
  onAction,
}: {
  readonly facts: readonly ProfileFact[];
  readonly onAction: (
    id: string,
    action: { action: "confirm" } | { action: "reject" },
  ) => void;
}) {
  if (!facts.length)
    return (
      <p className="text-sm text-muted-foreground">No profile facts yet.</p>
    );
  return (
    <ul className="divide-y rounded-lg border">
      {facts.map((fact) => (
        <li
          key={fact.id}
          className="flex flex-wrap items-center gap-2 p-3 text-sm"
        >
          <span className="w-40 font-mono text-xs">{fact.key}</span>
          <span className="flex-1 break-words">
            {typeof fact.value === "string"
              ? fact.value
              : JSON.stringify(fact.value)}
          </span>
          <span>{fact.status}</span>
          {fact.status === "proposed" && (
            <>
              <Button
                size="sm"
                aria-label={`Confirm ${fact.key}`}
                onClick={() => onAction(fact.id, { action: "confirm" })}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Reject ${fact.key}`}
                onClick={() => onAction(fact.id, { action: "reject" })}
              >
                Reject
              </Button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
