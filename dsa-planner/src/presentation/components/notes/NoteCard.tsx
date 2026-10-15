'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import type { ProblemNote } from '@/domain/entities/ProblemNote'

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'border-easy/30 bg-easy/10 text-easy',
  Medium: 'border-medium/30 bg-medium/10 text-medium',
  Hard: 'border-hard/30 bg-hard/10 text-hard',
}

interface ExplainResult {
  analogy: string
  stepByStep: string
  tip: string
}

interface NoteCardProps {
  note: ProblemNote
}

export function NoteCard({ note }: NoteCardProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [explaining, setExplaining] = useState(false)

  const handleChatAboutThis = () => {
    const message = `I want to understand my note for "${note.title}" better.\n\nPattern: ${note.pattern}\nTrick: ${note.trick}\nWhen to use: ${note.whenToUse}\n\nCan you explain this in even simpler terms with a real-life example?`
    const params = new URLSearchParams({ tab: 'chat', msg: message })
    router.push(`/coach?${params.toString()}`)
  }
  const [explanation, setExplanation] = useState<ExplainResult | null>(null)
  const [explainError, setExplainError] = useState(false)

  const handleExplainMore = async () => {
    if (explanation) { setExplanation(null); return }
    setExplaining(true)
    setExplainError(false)
    try {
      const res = await fetch('/api/notes/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          pattern: note.pattern,
          trick: note.trick,
          rawCode: note.rawCode,
        }),
      })
      const json = (await res.json()) as { data: ExplainResult }
      setExplanation(json.data)
    } catch {
      setExplainError(true)
    } finally {
      setExplaining(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold">
            <a
              href={`https://leetcode.com/problems/${note.titleSlug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {note.title}
            </a>
          </CardTitle>
          <div className="flex gap-1.5 flex-wrap">
            {note.difficulty && (
              <Badge className={DIFFICULTY_COLORS[note.difficulty] ?? 'bg-muted text-muted-foreground'}>
                {note.difficulty}
              </Badge>
            )}
            {note.pattern && (
              <Badge className="border-chart-4/30 bg-chart-4/10 text-chart-4">{note.pattern}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{note.lang}</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={handleChatAboutThis}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat about this
          </Button>
        </div>
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

        {/* Explain more section */}
        <div className="pt-1 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5"
            onClick={handleExplainMore}
            disabled={explaining}
          >
            {explaining
              ? '🤔 Thinking…'
              : explanation
                ? '✕ Hide explanation'
                : "🙋 I don't get it — explain simpler"}
          </Button>

          {explainError && (
            <p className="text-xs text-destructive mt-2 text-center">Failed to load. Try again.</p>
          )}

          {explanation && (
            <div className="mt-3 space-y-3 rounded-xl border border-info/25 bg-info/5 p-3">
              {explanation.analogy && (
                <div>
                  <p className="text-xs font-semibold text-info mb-1">💡 Think of it like this</p>
                  <p className="text-sm">{explanation.analogy}</p>
                </div>
              )}
              {explanation.stepByStep && (
                <div>
                  <p className="text-xs font-semibold text-info mb-1">👣 Step by step</p>
                  <p className="text-sm whitespace-pre-wrap">{explanation.stepByStep}</p>
                </div>
              )}
              {explanation.tip && (
                <div className="rounded-lg bg-info/10 px-3 py-2">
                  <p className="text-xs font-semibold text-info mb-0.5">📌 Remember next time</p>
                  <p className="text-sm">{explanation.tip}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
