"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStartImport } from "@/presentation/hooks/useImports";
export function ImportForm() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const start = useStartImport();
  const submit = () => {
    const form = new FormData();
    if (text.trim()) form.set("text", text);
    files.forEach((file) => form.append("files", file));
    start.mutate(form, {
      onSuccess: () => {
        setText("");
        setFiles([]);
      },
    });
  };
  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={8}
        placeholder="Paste notes, a resume, or a LinkedIn profile…"
        aria-label="Notes to import"
      />
      <input
        type="file"
        multiple
        accept=".md,.markdown,.txt,.pdf,.docx,.json,.csv"
        aria-label="Files to import"
        onChange={(event) => setFiles([...(event.target.files ?? [])])}
      />
      <Button
        onClick={submit}
        disabled={start.isPending || (!text.trim() && !files.length)}
      >
        {start.isPending ? "Starting…" : "Import"}
      </Button>
      {start.error && (
        <p className="text-sm text-destructive">{start.error.message}</p>
      )}
    </div>
  );
}
