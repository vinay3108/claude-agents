'use client'
import { useState, useCallback } from 'react'

export function useInterviewStream(sessionId: string) {
  const [currentText, setCurrentText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [completedHints, setCompletedHints] = useState<string[]>([])

  const requestHint = useCallback(
    (questionId: string, hintNumber: number) => {
      setCurrentText('')
      setStreaming(true)
      let accumulated = ''

      const url =
        `/api/interview/${sessionId}/stream` +
        `?questionId=${encodeURIComponent(questionId)}&hintNumber=${hintNumber}`
      const es = new EventSource(url)

      es.onmessage = (event: MessageEvent<string>) => {
        if (event.data === '[DONE]') {
          es.close()
          setCompletedHints((prev) => [...prev, accumulated])
          setCurrentText('')
          setStreaming(false)
          return
        }
        try {
          const { text } = JSON.parse(event.data) as { text: string }
          accumulated += text
          setCurrentText(accumulated)
        } catch {
          // ignore parse errors mid-stream
        }
      }

      es.onerror = () => {
        es.close()
        if (accumulated) setCompletedHints((prev) => [...prev, accumulated])
        setCurrentText('')
        setStreaming(false)
      }
    },
    [sessionId],
  )

  return { currentText, streaming, completedHints, requestHint }
}
