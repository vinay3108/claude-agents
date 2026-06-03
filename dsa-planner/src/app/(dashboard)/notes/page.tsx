'use client'
import { Skeleton } from '@/components/ui/skeleton'
import { NoteCard } from '@/presentation/components/notes/NoteCard'
import { useQuery } from '@tanstack/react-query'
import type { ProblemNote } from '@/domain/entities/ProblemNote'
import type { ApiSuccess } from '@/shared/utils/api-response'

async function fetchNotes(): Promise<ProblemNote[]> {
  const res = await fetch('/api/notes')
  const json = (await res.json()) as ApiSuccess<ProblemNote[]>
  return json.data
}

export default function NotesPage() {
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Problem Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated cheatsheets from your submissions. Sync to add new notes.
          </p>
        </div>
        {notes && notes.length > 0 && (
          <span className="text-sm text-muted-foreground">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (notes?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No notes yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to <strong>Settings</strong> and click <strong>Sync Now</strong> to generate your first notes.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notes?.map((note) => (
            <NoteCard key={note.submissionId} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
