import { createDrizzleClient } from '@/infrastructure/db/client'
import { createAIProvider } from '@/infrastructure/ai/createAIProvider'
import { SystemDesignAgent } from '@/infrastructure/ai/agents/SystemDesignAgent'
import { SupabaseSystemDesignSessionRepository } from '@/infrastructure/repositories/SupabaseSystemDesignSessionRepository'
import { getCurrentUser } from '@/shared/utils/get-current-user'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    await getCurrentUser()
    const { sessionId } = await params
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('questionId')
    const hintNumber = parseInt(searchParams.get('hintNumber') ?? '1', 10)

    if (!questionId) {
      return new Response('questionId required', { status: 400 })
    }

    const db = createDrizzleClient()
    const repo = new SupabaseSystemDesignSessionRepository(db)
    const question = await repo.findQuestionById(questionId)

    if (!question || question.sessionId !== sessionId) {
      return new Response('Question not found', { status: 404 })
    }

    const agent = new SystemDesignAgent(createAIProvider())
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const token of agent.streamHint(question, hintNumber)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: token })}\n\n`),
            )
          }
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
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
  } catch {
    return new Response('Unauthorized', { status: 401 })
  }
}
