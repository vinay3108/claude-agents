import type { UserId } from '../value-objects/UserId'

export type SystemDesignCategory = 'classic' | 'social' | 'infrastructure' | 'product'
export type SystemDesignDifficulty = 'junior' | 'senior' | 'staff'
export type SystemDesignStatus = 'active' | 'completed' | 'abandoned'

export interface SystemDesignSession {
  readonly id: string
  readonly userId: UserId
  readonly topic: string
  readonly category: SystemDesignCategory
  readonly difficulty: SystemDesignDifficulty
  readonly status: SystemDesignStatus
  readonly overallScore: number | null
  readonly aiFeedback: string | null
  readonly startedAt: Date
  readonly completedAt: Date | null
}

export const createSystemDesignSession = (
  params: Omit<SystemDesignSession, 'startedAt'> & { startedAt?: Date },
): SystemDesignSession => ({
  ...params,
  startedAt: params.startedAt ?? new Date(),
})
