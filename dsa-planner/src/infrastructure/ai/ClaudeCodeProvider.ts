import { execFile } from 'child_process'
import { promisify } from 'util'
import type { AIOptions, AIProvider, AIResponse } from './AIProvider'

const execFileAsync = promisify(execFile)

interface ClaudeJsonOutput {
  result: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  modelUsage?: Record<string, { inputTokens: number; outputTokens: number }>
}

export class ClaudeCodeProvider implements AIProvider {
  async runPrompt(prompt: string, options?: AIOptions): Promise<AIResponse> {
    const model = options?.model ?? process.env['CLAUDE_MODEL'] ?? 'claude-sonnet-4-6'

    // Vision requests require the SDK (execFile/CLI doesn't support image input)
    if (options?.imageBase64) {
      return this.runPromptWithVision(prompt, options.imageBase64, options.imageMimeType ?? 'image/png', model, options)
    }

    const args = [
      '--print', prompt,
      '--output-format', 'json',
      '--model', model,
    ]

    if (options?.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt)
    }

    const claudePath = process.env['CLAUDE_PATH'] ?? 'claude'

    const { stdout } = await execFileAsync(claudePath, args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
    })

    const parsed = JSON.parse(stdout.trim()) as ClaudeJsonOutput

    const modelEntry = parsed.modelUsage ? Object.entries(parsed.modelUsage)[0] : null
    const promptTokens = modelEntry?.[1]?.inputTokens ?? parsed.usage?.input_tokens ?? 0
    const completionTokens = modelEntry?.[1]?.outputTokens ?? parsed.usage?.output_tokens ?? 0

    return {
      content: parsed.result,
      promptTokens,
      completionTokens,
      model: modelEntry?.[0] ?? model,
    }
  }

  private async runPromptWithVision(
    prompt: string,
    imageBase64: string,
    imageMimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
    model: string,
    options?: AIOptions,
  ): Promise<AIResponse> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()

    const message = await client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageMimeType, data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })

    const content = message.content[0]?.type === 'text' ? message.content[0].text : ''
    return {
      content,
      promptTokens: message.usage.input_tokens,
      completionTokens: message.usage.output_tokens,
      model: message.model,
    }
  }

  async *streamPrompt(prompt: string, options?: AIOptions): AsyncIterable<string> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic()
    const model = options?.model ?? process.env['CLAUDE_MODEL'] ?? 'claude-haiku-4-5-20251001'

    const stream = client.messages.stream({
      model,
      max_tokens: options?.maxTokens ?? 1024,
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }
}
