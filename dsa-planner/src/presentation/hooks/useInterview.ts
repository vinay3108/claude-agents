'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InterviewSession, InterviewDifficulty } from '@/domain/entities/InterviewSession'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'
import type { StartInterviewResult } from '@/application/use-cases/StartInterviewSession'
import type { ApiSuccess } from '@/shared/utils/api-response'

export function useInterviewSessions() {
  return useQuery({
    queryKey: ['interview-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/interview')
      const json = (await res.json()) as ApiSuccess<InterviewSession[]>
      return json.data
    },
  })
}

export function useInterviewSession(sessionId: string) {
  return useQuery({
    queryKey: ['interview-session', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/interview/${sessionId}`)
      const json = (await res.json()) as ApiSuccess<StartInterviewResult>
      return json.data
    },
  })
}

export function useStartInterview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      topic: string
      difficulty: InterviewDifficulty
    }): Promise<StartInterviewResult> => {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<StartInterviewResult>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['interview-sessions'] }),
  })
}

export function useSubmitAnswer(sessionId: string) {
  return useMutation({
    mutationFn: async (params: {
      questionId: string
      code: string
      explanation: string
      hintsUsed: number
    }): Promise<InterviewResponse> => {
      const res = await fetch(`/api/interview/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<InterviewResponse>
      return json.data
    },
  })
}

export function useEvaluateSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<InterviewSession> => {
      const res = await fetch(`/api/interview/${sessionId}/evaluate`, {
        method: 'POST',
      })
      const json = (await res.json()) as ApiSuccess<InterviewSession>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['interview-sessions'] }),
  })
}
