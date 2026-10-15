'use client'
import { useState, useRef, useCallback, useSyncExternalStore } from 'react'

interface SREvent extends Event {
  readonly results: { isFinal: boolean; [index: number]: { transcript: string } }[]
  readonly resultIndex: number
}

type SR = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SREvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type SRConstructor = new () => SR

const noopSubscribe = () => () => undefined
const browserSupportsSpeech = () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window

export function useSpeechToText(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  // Server snapshot is `false`, so SSR and hydration render the same HTML; the
  // client value is read after hydration (reading window in useState caused #418).
  const supported = useSyncExternalStore(noopSubscribe, browserSupportsSpeech, () => false)
  const recognitionRef = useRef<SR | null>(null)

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }
    const SRClass = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SRClass) return

    const recognition = new SRClass()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: SREvent) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((r) => r.isFinal)
        .map((r) => r[0]!.transcript.trim())
        .filter(Boolean)
        .join(' ')
      if (transcript) onTranscript(transcript)
    }

    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
  }, [onTranscript])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { listening, supported, toggle, stop }
}
