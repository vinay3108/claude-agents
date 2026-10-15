import { afterEach, describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { renderHook } from '@testing-library/react'
import { useSpeechToText } from '@/presentation/hooks/useSpeechToText'

function Probe() {
  const { supported } = useSpeechToText(() => undefined)
  return <span>{supported ? 'mic' : 'no-mic'}</span>
}

describe('useSpeechToText.supported', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)['webkitSpeechRecognition']
  })

  it('renders the same on the server as the first client render (no hydration mismatch)', () => {
    ;(window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] = function SR() {}
    // The server/hydration snapshot must not look at window, or SSR and client HTML differ.
    expect(renderToString(<Probe />)).toContain('no-mic')
  })

  it('reports support on the client after hydration', () => {
    ;(window as unknown as Record<string, unknown>)['webkitSpeechRecognition'] = function SR() {}
    const { result } = renderHook(() => useSpeechToText(() => undefined))
    expect(result.current.supported).toBe(true)
  })

  it('reports no support when the browser lacks the API', () => {
    const { result } = renderHook(() => useSpeechToText(() => undefined))
    expect(result.current.supported).toBe(false)
  })
})
