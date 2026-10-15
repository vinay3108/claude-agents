import { randomUUID } from 'crypto'
import type { AIProvider } from '../AIProvider'
import { buildSystemDesignQuestionPrompt } from '../prompts/system-design-question'
import { buildEvaluateSystemDesignPrompt } from '../prompts/evaluate-system-design'
import { buildSystemDesignHintPrompt } from '../prompts/system-design-hint'
import type { SystemDesignSession } from '@/domain/entities/SystemDesignSession'
import type { SystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import { createSystemDesignQuestion } from '@/domain/entities/SystemDesignQuestion'
import type { SystemDesignResponse } from '@/domain/entities/SystemDesignResponse'
import type { AnalyticsResult } from '@/application/services/AnalyticsService'

interface QuestionRaw {
  questionText: string
  requirements: string[]
  hints: string[]
  evaluationDimensions: string[]
}

interface EvaluationRaw {
  dimensionScores: Record<string, number>
  feedback: string
}

const EVALUATION_DIMENSIONS = [
  'requirements',
  'components',
  'scalability',
  'trade_offs',
  'communication',
]

export class SystemDesignAgent {
  constructor(private readonly ai: AIProvider) {}

  async generateQuestion(
    session: SystemDesignSession,
    analytics: AnalyticsResult,
  ): Promise<SystemDesignQuestion> {
    const prompt = buildSystemDesignQuestionPrompt(session, analytics)
    const response = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<QuestionRaw>(response.content)

    return createSystemDesignQuestion({
      id: randomUUID(),
      sessionId: session.id,
      questionText:
        parsed.questionText ?? `Design a scalable ${session.topic} system.`,
      requirements: parsed.requirements ?? [],
      hints: parsed.hints ?? [],
      evaluationDimensions: parsed.evaluationDimensions ?? EVALUATION_DIMENSIONS,
    })
  }

  async *streamHint(
    question: SystemDesignQuestion,
    hintNumber: number,
  ): AsyncIterable<string> {
    if (this.ai.streamPrompt) {
      const prompt = buildSystemDesignHintPrompt(question.questionText, hintNumber)
      yield* this.ai.streamPrompt(prompt, {
        maxTokens: 256,
        model: 'claude-haiku-4-5-20251001',
      })
    } else {
      yield (
        question.hints[hintNumber - 1] ??
        'Think about the main bottleneck in this system.'
      )
    }
  }

  async evaluateResponse(
    question: SystemDesignQuestion,
    response: SystemDesignResponse,
  ): Promise<{ dimensionScores: Record<string, number>; feedback: string }> {
    // Vision analysis disabled until ANTHROPIC_API_KEY is configured
    const diagramMode: 'url-only' | 'none' = response.diagramUrl ? 'url-only' : 'none'

    const prompt = buildEvaluateSystemDesignPrompt(
      question.questionText,
      response.explanation,
      diagramMode,
    )
    const aiResponse = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<EvaluationRaw>(aiResponse.content)

    const dimensionScores: Record<string, number> = {}
    for (const dim of EVALUATION_DIMENSIONS) {
      const raw = parsed.dimensionScores?.[dim] ?? 5
      dimensionScores[dim] = Math.min(10, Math.max(0, raw))
    }

    return {
      dimensionScores,
      feedback:
        parsed.feedback ??
        'Review component design and consider scalability tradeoffs.',
    }
  }

  async generateFinalReport(
    session: SystemDesignSession,
    responses: SystemDesignResponse[],
  ): Promise<{ overallScore: number; feedback: string }> {
    if (responses.length === 0) {
      return { overallScore: 0, feedback: 'No responses submitted.' }
    }

    const lastResponse = responses[responses.length - 1]!
    const scores = Object.values(lastResponse.dimensionScores)
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0

    const prompt = `You are an interview coach. Summarize this system design session.

Topic: ${session.topic}
Difficulty: ${session.difficulty}
Dimension scores: ${JSON.stringify(lastResponse.dimensionScores)}
Average score: ${avgScore.toFixed(1)}/10

Provide a 2-3 sentence overall assessment and the top improvement area.

Respond with ONLY valid JSON:
{
  "overallScore": <0-10>,
  "feedback": "<2-3 sentences>"
}`

    const aiResponse = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<{ overallScore: number; feedback: string }>(
      aiResponse.content,
    )

    return {
      overallScore: Math.min(10, Math.max(0, parsed.overallScore ?? avgScore)),
      feedback:
        parsed.feedback ?? 'Session complete. Review your component design.',
    }
  }

  private parseJson<T>(content: string): Partial<T> {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch?.[0]) return {}
    try {
      return JSON.parse(jsonMatch[0]) as T
    } catch {
      return {}
    }
  }
}
