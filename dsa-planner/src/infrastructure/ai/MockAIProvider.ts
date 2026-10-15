import type { AIOptions, AIProvider, AIResponse } from './AIProvider'

export class MockAIProvider implements AIProvider {
  async runPrompt(prompt: string, options?: AIOptions): Promise<AIResponse> {
    const content = JSON.stringify({
      recommendations: [
        {
          type: 'topic',
          title: 'Practice Dynamic Programming',
          description: 'Focus on classic DP patterns: knapsack, LCS, coin change.',
          reasoning: 'Your DP mastery score is below 40%.',
          priority: 1,
        },
      ],
    })

    return {
      content,
      promptTokens: prompt.length,
      completionTokens: content.length,
      model: options?.model ?? 'mock',
    }
  }

  async *streamPrompt(_prompt: string): AsyncIterable<string> {
    yield 'Hint: Consider using a hash map to track elements you have seen. '
    yield 'This allows O(1) lookup instead of scanning the entire array each time.'
  }
}
