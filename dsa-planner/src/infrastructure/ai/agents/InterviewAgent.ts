import { randomUUID } from 'crypto'
import type { AIProvider } from '../AIProvider'
import { buildInterviewQuestionPrompt } from '../prompts/interview-question'
import { buildEvaluateResponsePrompt } from '../prompts/evaluate-response'
import { buildInterviewHintPrompt } from '../prompts/interview-hint'
import type { InterviewSession } from '@/domain/entities/InterviewSession'
import type { InterviewQuestion } from '@/domain/entities/InterviewQuestion'
import { createInterviewQuestion } from '@/domain/entities/InterviewQuestion'
import type { InterviewResponse } from '@/domain/entities/InterviewResponse'

interface QuestionRaw {
  questionText: string
  hints: string[]
  expectedConcepts: string[]
  boilerplateCode: Record<string, string>
}

interface EvaluationRaw {
  score: number
  feedback: string
}

export class InterviewAgent {
  constructor(private readonly ai: AIProvider) {}

  async generateQuestion(
    session: InterviewSession,
    orderIndex: number,
  ): Promise<InterviewQuestion> {
    const prompt = buildInterviewQuestionPrompt(session.topic, session.difficulty)
    const response = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<QuestionRaw>(response.content)

    return createInterviewQuestion({
      id: randomUUID(),
      sessionId: session.id,
      orderIndex,
      questionText:
        parsed.questionText ??
        `Explain how you would approach a ${session.difficulty} ${session.topic} problem.`,
      hints: parsed.hints ?? [],
      expectedConcepts: parsed.expectedConcepts ?? [],
      boilerplateCode: parsed.boilerplateCode ?? {},
    })
  }

  async *streamHint(
    question: InterviewQuestion,
    hintNumber: number,
  ): AsyncIterable<string> {
    if (this.ai.streamPrompt) {
      const prompt = buildInterviewHintPrompt(question.questionText, hintNumber)
      yield* this.ai.streamPrompt(prompt, {
        maxTokens: 256,
        model: 'claude-haiku-4-5-20251001',
      })
    } else {
      yield question.hints[hintNumber - 1] ?? 'Think about the time complexity constraints.'
    }
  }

  async evaluateResponse(
    question: InterviewQuestion,
    response: InterviewResponse,
  ): Promise<{ score: number; feedback: string }> {
    const prompt = buildEvaluateResponsePrompt(
      question.questionText,
      question.expectedConcepts,
      response.userCode,
      response.userExplanation,
    )
    const aiResponse = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<EvaluationRaw>(aiResponse.content)

    return {
      score: Math.min(10, Math.max(0, parsed.score ?? 5)),
      feedback: parsed.feedback ?? 'Keep practicing — consistency builds mastery.',
    }
  }

  async generateFinalReport(
    session: InterviewSession,
    responses: InterviewResponse[],
  ): Promise<{ overallScore: number; feedback: string }> {
    const avgScore =
      responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.score ?? 0), 0) / responses.length
        : 0

    const prompt = `You are an interview coach. Summarize this mock interview session.

Topic: ${session.topic}
Difficulty: ${session.difficulty}
Questions answered: ${responses.length}
Average score: ${avgScore.toFixed(1)}/10

Provide an honest overall assessment and 2-3 specific improvement areas.

Respond with ONLY valid JSON:
{
  "overallScore": <0-10>,
  "feedback": "<2-3 sentences: honest overall assessment and top improvement area>"
}`

    const aiResponse = await this.ai.runPrompt(prompt)
    const parsed = this.parseJson<{ overallScore: number; feedback: string }>(
      aiResponse.content,
    )

    return {
      overallScore: Math.min(10, Math.max(0, parsed.overallScore ?? avgScore)),
      feedback: parsed.feedback ?? 'Session complete. Review your solutions and retry.',
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
