'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ProblemNote } from '@/domain/entities/ProblemNote'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Hard: 'bg-red-100 text-red-800',
}

interface NoteCardProps {
  note: ProblemNote
}

export function NoteCard({ note }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold">
            <a
              href={`https://leetcode.com/problems/${note.titleSlug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline text-blue-600"
            >
              {note.title}
            </a>
          </CardTitle>
          <div className="flex gap-1.5 flex-wrap">
            {note.difficulty && (
              <Badge className={DIFFICULTY_COLORS[note.difficulty] ?? 'bg-gray-100 text-gray-800'}>
                {note.difficulty}
              </Badge>
            )}
            {note.pattern && (
              <Badge className="bg-purple-100 text-purple-800">{note.pattern}</Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{note.lang}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        {note.trick && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Trick</p>
            <p className="text-sm">{note.trick}</p>
          </div>
        )}

        {note.whenToUse && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">When to use</p>
            <p className="text-sm text-muted-foreground">{note.whenToUse}</p>
          </div>
        )}

        <div className="flex gap-4 text-xs text-muted-foreground">
          {note.timeComplexity && <span>Time: <strong className="text-foreground">{note.timeComplexity}</strong></span>}
          {note.spaceComplexity && <span>Space: <strong className="text-foreground">{note.spaceComplexity}</strong></span>}
        </div>

        {note.codeSnippet && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="px-0 text-xs h-auto"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Hide snippet ▲' : 'Show snippet ▼'}
            </Button>
            {expanded && (
              <pre className="mt-2 rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                {note.codeSnippet}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
