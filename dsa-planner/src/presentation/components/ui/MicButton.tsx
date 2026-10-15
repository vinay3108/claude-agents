'use client'
import { Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSpeechToText } from '@/presentation/hooks/useSpeechToText'

interface Props {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export function MicButton({ onTranscript, disabled }: Props) {
  const { listening, supported, toggle } = useSpeechToText(onTranscript)

  if (!supported) return null

  return (
    <Button
      type="button"
      variant={listening ? 'destructive' : 'outline'}
      size="icon"
      className="shrink-0"
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Stop recording' : 'Speak your answer'}
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  )
}
