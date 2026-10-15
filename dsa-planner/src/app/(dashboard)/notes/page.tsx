'use client'
import { useState, useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { NoteCard } from '@/presentation/components/notes/NoteCard'
import { useQuery } from '@tanstack/react-query'
import type { ProblemNote } from '@/domain/entities/ProblemNote'
import type { ApiSuccess } from '@/shared/utils/api-response'
import { PageHeader } from '@/presentation/components/layout/PageHeader'

async function fetchNotes(): Promise<ProblemNote[]> {
  const res = await fetch('/api/notes')
  const json = (await res.json()) as ApiSuccess<ProblemNote[]>
  return json.data
}

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'] as const
type DifficultyFilter = (typeof DIFFICULTIES)[number]

export default function NotesPage() {
  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
  })

  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All')

  const filtered = useMemo(() => {
    if (!notes) return []
    const q = search.toLowerCase().trim()
    return notes.filter((n) => {
      const matchesDifficulty = difficulty === 'All' || n.difficulty === difficulty
      const matchesSearch =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.pattern.toLowerCase().includes(q) ||
        n.trick.toLowerCase().includes(q)
      return matchesDifficulty && matchesSearch
    })
  }, [notes, search, difficulty])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="// track · notes"
        title="Problem Notes"
        description="Auto-generated cheatsheets from your submissions. Sync to add new notes."
        actions={
          notes && notes.length > 0 ? (
            <span className="rounded-full border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground">
              {filtered.length}/{notes.length} note{notes.length !== 1 ? 's' : ''}
            </span>
          ) : undefined
        }
      />

      {/* Search + filter bar — show once loaded and notes exist */}
      {!isLoading && (notes?.length ?? 0) > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by title, pattern, or keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-1.5">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  difficulty === d
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No notes match your search.</p>
          <button
            className="text-sm text-primary underline mt-2"
            onClick={() => { setSearch(''); setDifficulty('All') }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((note) => (
            <NoteCard key={note.submissionId} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
