'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GapAnalysis } from '@/domain/entities/GapAnalysis'
import type { StudyPlan } from '@/domain/entities/StudyPlan'
import type { ApiSuccess } from '@/shared/utils/api-response'

export function useGapAnalysis() {
  return useQuery({
    queryKey: ['gap-analysis'],
    queryFn: async () => {
      const res = await fetch('/api/coach/gap-analysis')
      const json = (await res.json()) as ApiSuccess<GapAnalysis | null>
      return json.data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useGenerateGapAnalysis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<GapAnalysis> => {
      const res = await fetch('/api/coach/gap-analysis', { method: 'POST' })
      const json = (await res.json()) as ApiSuccess<GapAnalysis>
      if (!res.ok) throw new Error((json as unknown as { error: { message: string } }).error.message)
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['gap-analysis'] }),
  })
}

export function useStudyPlans() {
  return useQuery({
    queryKey: ['study-plans'],
    queryFn: async () => {
      const res = await fetch('/api/study-plans')
      const json = (await res.json()) as ApiSuccess<StudyPlan[]>
      return json.data
    },
  })
}

export function useGenerateStudyPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      targetDays: number
      targetCompany: 'amazon' | 'google' | 'microsoft' | 'meta' | null
    }): Promise<StudyPlan> => {
      const res = await fetch('/api/study-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = (await res.json()) as ApiSuccess<StudyPlan>
      return json.data
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['study-plans'] }),
  })
}
