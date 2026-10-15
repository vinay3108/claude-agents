'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MicButton } from '@/presentation/components/ui/MicButton'
import { useEffect } from 'react'
import { QuestionDisplay } from './QuestionDisplay'
import { HintPanel } from './HintPanel'
import { EvaluationReport } from './EvaluationReport'
import { CodeRunner } from './CodeRunner'
import type { Language } from './CodeRunner'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'

interface Props {
  sessionId: string
  question: InterviewQuestion
  onSubmit: (
    code: string,
    explanation: string,
    hintsUsed: number,
  ) => Promise<InterviewResponse>
  onEnd: () => void
}

export function InterviewPanel({ sessionId, question, onSubmit, onEnd }: Props) {
  const [language, setLanguage] = useState<Language>('python')
  const [boilerplate, setBoilerplate] = useState<Record<string, string>>(
    () => question.boilerplateCode as Record<string, string>,
  )
  const [code, setCode] = useState(() => question.boilerplateCode['python'] ?? '')
  const [explanation, setExplanation] = useState('')
  const [hintsUsed, setHintsUsed] = useState(0)
  const [response, setResponse] = useState<InterviewResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fetchingBoilerplate, setFetchingBoilerplate] = useState(false)

  // Auto-fetch boilerplate if question was created before this feature
  useEffect(() => {
    if (Object.keys(boilerplate).length > 0) return
    setFetchingBoilerplate(true)
    fetch(`/api/interview/${sessionId}/boilerplate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: question.id }),
    })
      .then((r) => r.json())
      .then((json: { data?: { boilerplate: Record<string, string> } }) => {
        if (json.data?.boilerplate) {
          setBoilerplate(json.data.boilerplate)
          setCode(json.data.boilerplate[language] ?? '')
        }
      })
      .finally(() => setFetchingBoilerplate(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const starter = boilerplate[language]
    if (starter) setCode(starter)
  }, [language, boilerplate])

  const handleSubmit = async () => {
    if (!code.trim()) return
    setSubmitting(true)
    try {
      const result = await onSubmit(code, explanation, hintsUsed)
      setResponse(result)
    } finally {
      setSubmitting(false)
    }
  }

  if (response) {
    return (
      <EvaluationReport
        response={response}
        onEnd={onEnd}
      />
    )
  }

  return (
    <div className="space-y-4">
      <QuestionDisplay question={question} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Your Code</label>
          {fetchingBoilerplate && (
            <span className="text-xs text-muted-foreground animate-pulse">Generating starter code…</span>
          )}
        </div>
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={fetchingBoilerplate ? 'Generating starter code…' : 'Write your solution here…'}
          className="font-mono text-xs h-56 resize-none"
          disabled={fetchingBoilerplate}
        />
      </div>

      <CodeRunner
        code={code}
        language={language}
        onLanguageChange={setLanguage}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Explain your approach</label>
          <MicButton
            onTranscript={(text) => setExplanation((prev) => prev ? `${prev} ${text}` : text)}
            disabled={submitting}
          />
        </div>
        <Textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Walk me through your thinking…"
          className="text-sm h-56 resize-none"
        />
      </div>

      <HintPanel
        sessionId={sessionId}
        question={question}
        onHintUsed={() => setHintsUsed((n) => n + 1)}
      />

      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !code.trim()}
        >
          {submitting ? 'Evaluating…' : 'Submit Solution'}
        </Button>
        <Button variant="outline" onClick={onEnd}>
          End Session
        </Button>
      </div>
    </div>
  )
}
