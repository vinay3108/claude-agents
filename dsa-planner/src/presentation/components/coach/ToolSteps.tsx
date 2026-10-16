"use client";
import { Check, Loader2, TriangleAlert } from "lucide-react";
export interface ToolStep {
  readonly id: string;
  readonly tool: string;
  readonly label: string;
  readonly status: "running" | "done" | "error";
  readonly summary: string;
}
export function ToolSteps({ steps }: { readonly steps: readonly ToolStep[] }) {
  if (!steps.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Agent steps">
      {steps.map((step) => (
        <li
          key={step.id}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
        >
          <>
            {step.status === "running" && (
              <Loader2 className="size-3 animate-spin" />
            )}
            {step.status === "done" && <Check className="size-3" />}
            {step.status === "error" && <TriangleAlert className="size-3" />}
          </>
          <span>
            {step.status === "running"
              ? `${step.label}…`
              : step.summary || step.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
