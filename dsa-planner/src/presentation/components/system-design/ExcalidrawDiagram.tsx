'use client'
import { useRef, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { Button } from '@/components/ui/button'

// Dynamically import the wrapper (which brings in CSS + Excalidraw) — no SSR
const Excalidraw = dynamic(
  () => import('./ExcalidrawWrapper').then((m) => m.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading canvas…
      </div>
    ),
  },
)

interface Props {
  sessionId: string
  onSave: (url: string) => void
  savedUrl: string | null
}

export function ExcalidrawDiagram({ sessionId, onSave, savedUrl }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = useCallback(async () => {
    const api = apiRef.current
    if (!api) return

    setSaving(true)
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw')
      const elements = api.getSceneElements()
      const appState = api.getAppState()

      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportWithDarkMode: false },
        files: api.getFiles(),
        mimeType: 'image/png',
        quality: 0.92,
      })

      const formData = new FormData()
      formData.append('diagram', new File([blob], 'diagram.png', { type: 'image/png' }))

      const res = await fetch(`/api/system-design/${sessionId}/upload`, {
        method: 'POST',
        body: formData,
      })
      const json = (await res.json()) as { data: { url: string } }
      onSave(json.data.url)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }, [sessionId, onSave])

  return (
    <div className="space-y-2">
      {/*
        Outer ring: visible border + rounded corners.
        Inner div: overflow:hidden clips the canvas to the rounded shape
        without clipping the toolbar (which is inside the Excalidraw root).
      */}
      <div
        style={{
          borderRadius: 10,
          border: '2px solid #cbd5e1',
          padding: 0,
          background: '#fff',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: 520,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <Excalidraw
            excalidrawAPI={(api) => { apiRef.current = api }}
            theme="light"
            initialData={{ appState: { viewBackgroundColor: '#ffffff' } }}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? '✓ Diagram saved' : 'Save Diagram'}
        </Button>
        {savedUrl && (
          <span className="text-xs text-muted-foreground">
            Diagram included with submission.
          </span>
        )}
      </div>
    </div>
  )
}
