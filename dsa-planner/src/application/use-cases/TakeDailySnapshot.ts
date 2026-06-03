import { randomUUID } from 'crypto'
import { createDailySnapshot } from '@/domain/entities/DailySnapshot'
import type { TopicProgress } from '@/domain/entities/DailySnapshot'
import { createProblemNote } from '@/domain/entities/ProblemNote'
import type { ILeetCodeProfileRepository } from '@/domain/repositories/ILeetCodeProfileRepository'
import type { ISnapshotRepository } from '@/domain/repositories/ISnapshotRepository'
import type { IProblemNoteRepository } from '@/domain/repositories/IProblemNoteRepository'
import { AppError } from '@/shared/errors/AppError'
import { MasteryScore } from '@/domain/value-objects/MasteryScore'
import type { LeetCodeGraphQLClient } from '@/infrastructure/leetcode/LeetCodeGraphQLClient'
import type { AIOrchestrationService } from '@/infrastructure/ai/AIOrchestrationService'
import type { UserId } from '@/domain/value-objects/UserId'

const SYNC_COOLDOWN_MS = (Number(process.env['LEETCODE_SYNC_COOLDOWN_SECONDS'] ?? 300)) * 1000

export interface TakeDailySnapshotInput {
  userId: string
}

export interface TakeDailySnapshotResult {
  snapshotId: string
  totalSolved: number
  snapshotDate: Date
  notesGenerated: number
}

export class TakeDailySnapshot {
  constructor(
    private readonly profileRepo: ILeetCodeProfileRepository,
    private readonly snapshotRepo: ISnapshotRepository,
    private readonly leetcodeClient: LeetCodeGraphQLClient,
    private readonly noteRepo?: IProblemNoteRepository,
    private readonly aiService?: AIOrchestrationService,
  ) {}

  async execute(input: TakeDailySnapshotInput): Promise<TakeDailySnapshotResult> {
    const userId = input.userId as UserId

    const profile = await this.profileRepo.findByUserId(userId)
    if (!profile) throw AppError.notFound('LeetCode profile')

    if (profile.lastSyncedAt) {
      const elapsed = Date.now() - profile.lastSyncedAt.getTime()
      if (elapsed < SYNC_COOLDOWN_MS) {
        const remaining = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000)
        throw new AppError(
          'SYNC_COOLDOWN_ACTIVE',
          `Sync cooldown active. Try again in ${remaining}s.`,
          429,
        )
      }
    }

    const [stats, topicStats, contestInfo] = await Promise.all([
      this.leetcodeClient.getUserStats(profile.username),
      this.leetcodeClient.getTopicStats(profile.username),
      this.leetcodeClient.getContestInfo(profile.username),
    ])

    if (!stats) {
      throw new AppError('LEETCODE_FETCH_ERROR', 'Failed to fetch LeetCode data. Profile may be private.', 502)
    }

    const topicProgress: TopicProgress[] = topicStats.map((t) => ({
      topicId: t.tagSlug,
      topicSlug: t.tagSlug,
      solved: t.problemsSolved,
      attempted: t.problemsSolved,
      masteryScore: MasteryScore.of(Math.min(100, Math.round((t.problemsSolved / 50) * 100))),
    }))

    const snapshot = createDailySnapshot({
      id: randomUUID(),
      userId,
      leetcodeProfileId: profile.id,
      snapshotDate: new Date(),
      totalSolved: stats.totalSolved,
      easySolved: stats.easySolved,
      mediumSolved: stats.mediumSolved,
      hardSolved: stats.hardSolved,
      totalSubmissions: stats.totalSubmissions,
      ranking: stats.ranking,
      contestRating: contestInfo?.rating ?? null,
      topicProgress,
    })

    await this.snapshotRepo.save(snapshot)
    await this.profileRepo.updateLastSynced(profile.id, new Date())

    const notesGenerated = await this.generateNotes(input.userId, profile.username)

    return {
      snapshotId: snapshot.id,
      totalSolved: snapshot.totalSolved,
      snapshotDate: snapshot.snapshotDate,
      notesGenerated,
    }
  }

  private async generateNotes(userId: string, username: string): Promise<number> {
    if (!this.noteRepo || !this.aiService) return 0

    try {
      const recentSubmissions = await this.leetcodeClient.getRecentSubmissions(username, 20)
      if (recentSubmissions.length === 0) return 0

      const existingIds = await this.noteRepo.findSubmissionIdsByUserId(userId)
      const newSubmissions = recentSubmissions.filter((s) => !existingIds.has(s.id))
      if (newSubmissions.length === 0) return 0

      const notes = await Promise.all(
        newSubmissions.map(async (sub) => {
          try {
            const details = await this.leetcodeClient.getSubmissionDetails(sub.id)
            const code = details?.code ?? ''
            const lang = details?.lang ?? sub.lang
            const difficulty = details?.difficulty ?? ''

            const fields = await this.aiService!.generateProblemNote(sub.title, lang, code)

            return createProblemNote({
              id: randomUUID(),
              userId,
              submissionId: sub.id,
              titleSlug: sub.titleSlug,
              title: sub.title,
              difficulty,
              lang,
              rawCode: code,
              ...fields,
              createdAt: new Date(),
            })
          } catch {
            return null
          }
        }),
      )

      const validNotes = notes.filter((n): n is NonNullable<typeof n> => n !== null)
      await this.noteRepo.saveMany(validNotes)
      return validNotes.length
    } catch {
      return 0
    }
  }
}
