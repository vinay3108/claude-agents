import { z } from 'zod'
import { createDrizzleClient } from '@/infrastructure/db/client'
import { getCurrentUser } from '@/shared/utils/get-current-user'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { DrizzleCoachChatRepository } from '@/infrastructure/repositories/DrizzleCoachChatRepository'
import { SupabaseSnapshotRepository } from '@/infrastructure/repositories/SupabaseSnapshotRepository'
import { SupabaseGapAnalysisRepository } from '@/infrastructure/repositories/SupabaseGapAnalysisRepository'
import { SupabaseStudyPlanRepository } from '@/infrastructure/repositories/SupabaseStudyPlanRepository'
import { SupabaseInterviewSessionRepository } from '@/infrastructure/repositories/SupabaseInterviewSessionRepository'
import { AnalyticsService } from '@/application/services/AnalyticsService'
import { UserId } from '@/domain/value-objects/UserId'
import { DateRange } from '@/domain/value-objects/DateRange'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { buildCoachChatSystemPrompt } from '@/infrastructure/ai/prompts/coach-chat-system-prompt'

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4000),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new DrizzleCoachChatRepository(db)
    const session = await repo.findOrCreateSession(user.id)
    const messages = await repo.getMessages(session.id, 50)
    return apiOk({ sessionId: session.id, messages })
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const body = sendMessageSchema.parse(await request.json())

    const db = createDrizzleClient()
    const chatRepo = new DrizzleCoachChatRepository(db)
    const userId = UserId.fromString(user.id)

    const session = await chatRepo.findOrCreateSession(user.id)

    await chatRepo.addMessage({ sessionId: session.id, role: 'user', content: body.message })

    const [analytics, gapAnalysis, studyPlans, interviewSessions, history] = await Promise.all([
      (async () => {
        const snapshotRepo = new SupabaseSnapshotRepository(db)
        const snapshots = await snapshotRepo.findByUserId(userId, DateRange.lastDays(30))
        return new AnalyticsService().compute(snapshots)
      })(),
      new SupabaseGapAnalysisRepository(db).findLatestByUserId(userId),
      new SupabaseStudyPlanRepository(db).findActiveByUserId(userId),
      new SupabaseInterviewSessionRepository(db).findByUserId(userId),
      chatRepo.getMessages(session.id, 20),
    ])

    const activePlan = studyPlans.find((p) => p.status === 'active') ?? null
    const completedInterviews = interviewSessions
      .filter((s) => s.status === 'completed')
      .slice(0, 3)

    const systemPrompt = buildCoachChatSystemPrompt(
      analytics,
      gapAnalysis,
      activePlan,
      completedInterviews,
    )

    const conversationHistory = history.slice(-20)
    const messagesForAI = conversationHistory
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')
    const fullPrompt = messagesForAI
      ? `${messagesForAI}\nUser: ${body.message}`
      : body.message

    const ai = createAIProvider()
    const aiResponse = await ai.runPrompt(fullPrompt, { systemPrompt })
    const content = aiResponse.content

    await chatRepo.addMessage({ sessionId: session.id, role: 'assistant', content })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const tokens = content.match(/\S+\s*/g) ?? [content]
        for (const token of tokens) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    return apiError(err)
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser()
    const db = createDrizzleClient()
    const repo = new DrizzleCoachChatRepository(db)
    const session = await repo.findOrCreateSession(user.id)
    await repo.clearMessages(session.id)
    return apiOk({ cleared: true })
  } catch (err) {
    return apiError(err)
  }
}
