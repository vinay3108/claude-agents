"use client";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeItem } from "@/domain/entities/KnowledgeItem";
export function KnowledgeList({
  items,
}: {
  readonly items: readonly KnowledgeItem[];
}) {
  if (!items.length)
    return (
      <p className="text-sm text-muted-foreground">
        Nothing found. Import notes or connect your vault.
      </p>
    );
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="space-y-1 rounded-lg border p-3">
          <div className="flex gap-2">
            <h3 className="flex-1 truncate text-sm font-semibold">
              {item.title}
            </h3>
            <Badge variant="outline">{item.kind}</Badge>
          </div>
          <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
            {item.bodyMd}
          </p>
        </li>
      ))}
    </ul>
  );
}
