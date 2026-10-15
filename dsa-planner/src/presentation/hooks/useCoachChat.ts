'use client'
import { useState, useCallback, useEffect } from 'react'
import type { ChatMessage } from '@/domain/entities/ChatMessage'

interface CoachChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingContent: string
  error: string | null
}

export function useCoachChat() {
  const [state, setState] = useState<CoachChatState>({
    messages: [],
    isLoading: true,
    isStreaming: false,
    streamingContent: '',
    error: null,
  })

  const loadHistory = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const res = await fetch('/api/coach/chat')
      const json = (await res.json()) as {
        success: boolean
        data: { messages: ChatMessage[] }
      }
      setState((s) => ({ ...s, messages: json.data.messages, isLoading: false }))
    } catch {
      setState((s) => ({ ...s, isLoading: false, error: 'Failed to load chat history' }))
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      sessionId: '',
      role: 'user',
      content: text,
      createdAt: new Date(),
    }

    setState((s) => ({
      ...s,
      messages: [...s.messages, userMessage],
      isStreaming: true,
      streamingContent: '',
      error: null,
    }))

    try {
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const data = part.replace(/^data: /, '').trim()
          if (data === '[DONE]') {
            const assistantMessage: ChatMessage = {
              id: `temp-assistant-${Date.now()}`,
              sessionId: '',
              role: 'assistant',
              content: accumulated,
              createdAt: new Date(),
            }
            setState((s) => ({
              ...s,
              messages: [...s.messages, assistantMessage],
              isStreaming: false,
              streamingContent: '',
            }))
            return
          }
          try {
            const { text: token } = JSON.parse(data) as { text: string }
            accumulated += token
            setState((s) => ({ ...s, streamingContent: accumulated }))
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }
    } catch {
      setState((s) => ({
        ...s,
        isStreaming: false,
        streamingContent: '',
        error: 'Failed to send message. Please try again.',
      }))
    }
  }, [])

  const clearChat = useCallback(async () => {
    try {
      await fetch('/api/coach/chat', { method: 'DELETE' })
      setState((s) => ({ ...s, messages: [], streamingContent: '', error: null }))
    } catch {
      setState((s) => ({ ...s, error: 'Failed to clear chat' }))
    }
  }, [])

  return { ...state, sendMessage, clearChat }
}
