'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SystemDesignSession, SystemDesignCategory, SystemDesignDifficulty } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { StartSystemDesignResult } from '@/application/use-cases/StartSystemDesignSession'
import type { ApiSuccess } from '@/shared/utils/api-response'

export function useSystemDesignSessions() {
  return useQuery({
    queryKey: ['system-design-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/system-design')
      const json = (await res.json()) as ApiSuccess<SystemDesignSession[]>
      return json.data
    },
  })
}

export function useSystemDesignSession(sessionId: string) {
  return useQuery({
    queryKey: ['system-design-session', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/system-design/${sessionId}`)
      const json = (await res.json()) as ApiSuccess<{
        session: SystemDesignSession
        question: SystemDesignQuestion | null
        response: SystemDesignResponse | null
      }>
      return json.data
    },
  })
}

export function useStartSystemDesign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      topic: string
      category: SystemDesignCategory
      difficulty: SystemDesignDifficulty
    }): Promise<StartSystemDesignResult> => {
      const res = await fetch('/api/system-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<StartSystemDesignResult>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['system-design-sessions'] }),
  })
}

export function useSubmitSystemDesignResponse(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      questionId: string
      explanation: string
      diagramUrl: string | null
    }): Promise<SystemDesignResponse> => {
      const res = await fetch(`/api/system-design/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<SystemDesignResponse>
      return json.data
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['system-design-session', sessionId] }),
  })
}

export function useEvaluateSystemDesignSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<SystemDesignSession> => {
      const res = await fetch(`/api/system-design/${sessionId}/evaluate`, {
        method: 'POST',
      })
      const json = (await res.json()) as ApiSuccess<SystemDesignSession>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['system-design-sessions'] }),
  })
}
