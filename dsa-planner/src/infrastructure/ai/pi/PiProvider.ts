import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AIOptions, AIProvider, AIResponse } from '../AIProvider'
import { parsePiEventLine, assertAssistantSucceeded, toAIResponse } from './piEvents'
import type { PiAssistantMessage } from './piEvents'
import { loadPiConfig } from './piConfig'
import type { PiConfig } from './piConfig'
import { resolvePiModel } from './piModel'
import { PiProviderError } from './PiProviderError'
import { runPiProcess } from './runPiProcess'
import type { SpawnFn } from './runPiProcess'

/**
 * Without --system-prompt, pi uses its coding-assistant prompt. The app's agents
 * want a plain completion, so use a neutral default instead.
 */
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.'

/**
 * Pi runs as a plain completion engine: no tools, no session file, no skills,
 * no AGENTS.md/CLAUDE.md. Extensions stay on because model providers such as
 * `kiro` are registered by extensions.
 */
const BASE_ARGS = [
  '--mode', 'json',
  '--print',
  '--no-session',
  '--no-tools',
  '--no-skills',
  '--no-context-files',
  '--no-prompt-templates',
] as const

const IMAGE_EXTENSIONS: Record<NonNullable<AIOptions['imageMimeType']>, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

interface PiCall {
  readonly args: readonly string[]
  readonly model: string
  readonly cleanup: () => Promise<void>
}

/**
 * AIProvider backed by the `pi` CLI (`pi --mode json`).
 *
 * Note: pi has no max-output-token flag, so `AIOptions.maxTokens` is ignored.
 */
export class PiProvider implements AIProvider {
  private readonly config: PiConfig

  constructor(
    config: PiConfig = loadPiConfig(),
    private readonly spawn?: SpawnFn,
  ) {
    this.config = config
  }

  async runPrompt(prompt: string, options?: AIOptions): Promise<AIResponse> {
    const call = await this.prepareCall(options)
    try {
      let last: PiAssistantMessage | undefined
      for await (const line of this.run(call, prompt)) {
        const event = parsePiEventLine(line)
        if (event.kind === 'assistant_end') {
          last = event.message
        }
      }
      if (!last) {
        throw new PiProviderError('pi finished without an assistant message')
      }
      return toAIResponse(last, call.model)
    } finally {
      await call.cleanup()
    }
  }

  async *streamPrompt(prompt: string, options?: AIOptions): AsyncIterable<string> {
    const call = await this.prepareCall(options)
    try {
      let finished = false
      for await (const line of this.run(call, prompt)) {
        const event = parsePiEventLine(line)
        if (event.kind === 'text_delta') {
          yield event.delta
        } else if (event.kind === 'assistant_end') {
          assertAssistantSucceeded(event.message)
          finished = true
        }
      }
      if (!finished) {
        throw new PiProviderError('pi stream ended without an assistant message')
      }
    } finally {
      await call.cleanup()
    }
  }

  private run(call: PiCall, prompt: string): AsyncGenerator<string> {
    return runPiProcess(
      {
        command: this.config.command,
        args: call.args,
        stdin: prompt,
        // Neutral cwd: pi must not pick up this repo's project-local config.
        cwd: tmpdir(),
        timeoutMs: this.config.timeoutMs,
      },
      this.spawn,
    )
  }

  private async prepareCall(options?: AIOptions): Promise<PiCall> {
    const model = resolvePiModel(options?.model, this.config)
    const args: string[] = [
      ...BASE_ARGS,
      '--model', model,
      '--system-prompt', options?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    ]
    if (this.config.thinking) {
      args.push('--thinking', this.config.thinking)
    }

    if (!options?.imageBase64) {
      return { args, model, cleanup: async () => undefined }
    }

    // pi accepts images only as `@file` arguments, so write the image to a private temp dir.
    const dir = await mkdtemp(join(tmpdir(), 'dsa-pi-'))
    const cleanup = () => rm(dir, { recursive: true, force: true })
    try {
      const ext = IMAGE_EXTENSIONS[options.imageMimeType ?? 'image/png']
      const imagePath = join(dir, `image.${ext}`)
      await writeFile(imagePath, Buffer.from(options.imageBase64, 'base64'), { mode: 0o600 })
      // `--` stops option parsing; the @file must come after all flags.
      return { args: [...args, '--', `@${imagePath}`], model, cleanup }
    } catch (err) {
      await cleanup()
      throw err
    }
  }
}
