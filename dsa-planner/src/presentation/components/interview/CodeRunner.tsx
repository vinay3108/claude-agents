'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

const LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'go', label: 'Go' },
  { id: 'typescript', label: 'TypeScript' },
] as const

type Language = (typeof LANGUAGES)[number]['id']

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

interface Props {
  code: string
  language: Language
  onLanguageChange: (lang: Language) => void
}

export function CodeRunner({ code, language, onLanguageChange }: Props) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)

  const handleRun = async () => {
    if (!code.trim() || running) return
    setRunning(true)
    setResult(null)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code }),
      })
      const json = (await res.json()) as { data: RunResult; error?: { message: string } | string }
      if (json.error) {
        const msg = typeof json.error === 'string' ? json.error : json.error.message
        setResult({ stdout: '', stderr: msg, exitCode: -1 })
      } else {
        setResult(json.data)
      }
    } catch {
      setResult({ stdout: '', stderr: 'Failed to reach execution server.', exitCode: -1 })
    } finally {
      setRunning(false)
    }
  }

  const passed = result !== null && result.exitCode === 0 && !result.stderr

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            onClick={() => onLanguageChange(lang.id)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              language === lang.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            {lang.label}
          </button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={handleRun}
          disabled={!code.trim() || running}
          className="ml-auto gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          {running ? 'Running…' : 'Run Code'}
        </Button>
      </div>

      {result !== null && (
        <div
          className={`rounded border text-xs font-mono p-3 whitespace-pre-wrap leading-relaxed ${
            passed
              ? 'border-easy/30 bg-easy/10 text-easy'
              : 'border-hard/30 bg-hard/10 text-hard'
          }`}
        >
          {result.stdout && <span>{result.stdout}</span>}
          {result.stderr && (
            <span className="text-hard">{result.stderr}</span>
          )}
          {!result.stdout && !result.stderr && (
            <span className="text-muted-foreground italic">No output</span>
          )}
        </div>
      )}
    </div>
  )
}

export type { Language }
