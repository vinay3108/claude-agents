import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import { PiProvider } from '@/infrastructure/ai/pi/PiProvider'
import { loadPiConfig } from '@/infrastructure/ai/pi/piConfig'
import type { EnvSource } from '@/infrastructure/ai/pi/piConfig'
import { PiProviderError } from '@/infrastructure/ai/pi/PiProviderError'
import { fakePiSpawn, piLines } from './fakePiSpawn'
import type { FakePiScript } from './fakePiSpawn'

function makeProvider(script: FakePiScript, env: EnvSource = {}) {
  const fake = fakePiSpawn(script)
  return { provider: new PiProvider(loadPiConfig(env), fake.spawn), runs: fake.runs }
}

async function collect(stream: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = []
  for await (const chunk of stream) out.push(chunk)
  return out
}

describe('PiProvider.runPrompt', () => {
  it('returns the final assistant message', async () => {
    const { provider, runs } = makeProvider({
      lines: [piLines.session(), piLines.userEnd('q'), piLines.delta('ok'), piLines.assistantEnd('{"a":1}')],
    })

    const res = await provider.runPrompt('@ starts with at', { systemPrompt: 'Be JSON.' })

    expect(res).toEqual({
      content: '{"a":1}',
      promptTokens: 12,
      completionTokens: 3,
      model: 'kiro/claude-haiku-4-5',
    })
    const run = runs[0]!
    expect(run.command).toBe('pi')
    expect(run.cwd).toBe(tmpdir())
    // Prompt goes on stdin, never as an argument.
    expect(run.stdin).toBe('@ starts with at')
    expect(run.args).not.toContain('@ starts with at')
    expect(run.args).toEqual(
      expect.arrayContaining(['--mode', 'json', '--print', '--no-session', '--no-tools']),
    )
    expect(argAfter(run.args, '--model')).toBe('kiro/claude-sonnet-5-5')
    expect(argAfter(run.args, '--system-prompt')).toBe('Be JSON.')
  })

  it('uses a neutral system prompt, maps the requested model, and passes thinking', async () => {
    const { provider, runs } = makeProvider(
      { lines: [piLines.assistantEnd('x')] },
      { PI_THINKING: 'off' },
    )

    await provider.runPrompt('hi', { model: 'claude-haiku-4-5-20251001' })

    const args = runs[0]!.args
    expect(argAfter(args, '--model')).toBe('kiro/claude-haiku-4-5')
    expect(argAfter(args, '--system-prompt')).toBe('You are a helpful assistant.')
    expect(argAfter(args, '--thinking')).toBe('off')
  })

  it('writes an image to a temp @file and removes it afterwards', async () => {
    let seenBytes = ''
    const { provider, runs } = makeProvider({
      lines: [piLines.assistantEnd('red')],
      onSpawn: (run) => {
        seenBytes = readFileSync(run.args.at(-1)!.slice(1), 'utf8')
      },
    })

    const res = await provider.runPrompt('colour?', {
      imageBase64: Buffer.from('fake-image').toString('base64'),
      imageMimeType: 'image/jpeg',
    })

    const args = runs[0]!.args
    const fileArg = args.at(-1)!
    expect(res.content).toBe('red')
    expect(args.at(-2)).toBe('--')
    expect(fileArg).toMatch(/^@.*dsa-pi-.*image\.jpg$/)
    expect(seenBytes).toBe('fake-image')
    expect(existsSync(fileArg.slice(1))).toBe(false)
  })

  it('throws when pi reports a model error', async () => {
    const { provider } = makeProvider({
      lines: [piLines.assistantEnd('', { stopReason: 'error', errorMessage: 'AccessDenied' })],
    })
    await expect(provider.runPrompt('hi')).rejects.toThrow(/AccessDenied/)
  })

  it('throws when pi exits non-zero, with stderr in the message', async () => {
    const { provider } = makeProvider({ exitCode: 1, stderr: 'Model "x" not found' })
    await expect(provider.runPrompt('hi')).rejects.toThrow(/code 1: Model "x" not found/)
  })

  it('throws when pi gives no assistant message', async () => {
    const { provider } = makeProvider({ lines: [piLines.session()] })
    await expect(provider.runPrompt('hi')).rejects.toThrow(/without an assistant message/)
  })

  it('throws a clear error when the binary is missing', async () => {
    const { provider } = makeProvider({ spawnError: new Error('spawn pi ENOENT') })
    await expect(provider.runPrompt('hi')).rejects.toThrow(/Failed to start pi \(pi\): spawn pi ENOENT/)
  })

  it('kills pi and throws on timeout', async () => {
    const { provider } = makeProvider({ hang: true }, { PI_TIMEOUT_MS: '20' })
    await expect(provider.runPrompt('hi')).rejects.toThrow(/timed out after 20 ms/)
  })
})

describe('PiProvider.streamPrompt', () => {
  it('yields text deltas in order', async () => {
    const { provider } = makeProvider({
      lines: [piLines.delta('Hint: '), piLines.delta('use a map'), piLines.assistantEnd('Hint: use a map')],
    })
    expect(await collect(provider.streamPrompt('hint?'))).toEqual(['Hint: ', 'use a map'])
  })

  it('throws after partial output when the model fails', async () => {
    const { provider } = makeProvider({
      lines: [piLines.delta('par'), piLines.assistantEnd('', { stopReason: 'aborted' })],
    })
    const seen: string[] = []
    await expect(async () => {
      for await (const chunk of provider.streamPrompt('x')) seen.push(chunk)
    }).rejects.toThrow(PiProviderError)
    expect(seen).toEqual(['par'])
  })

  it('throws when the stream ends without an assistant message', async () => {
    const { provider } = makeProvider({ lines: [piLines.delta('a')] })
    await expect(collect(provider.streamPrompt('x'))).rejects.toThrow(/stream ended/)
  })

  it('stops pi when the consumer stops early', async () => {
    const { provider } = makeProvider({
      lines: [piLines.delta('a'), piLines.delta('b'), piLines.assistantEnd('ab')],
    })
    for await (const chunk of provider.streamPrompt('x')) {
      expect(chunk).toBe('a')
      break
    }
  })
})

function argAfter(args: readonly string[], flag: string): string | undefined {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}
