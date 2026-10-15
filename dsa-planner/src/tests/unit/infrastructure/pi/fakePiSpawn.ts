import { EventEmitter } from 'events'
import { PassThrough, Writable } from 'stream'
import type { ChildProcess } from 'child_process'
import type { SpawnFn } from '@/infrastructure/ai/pi/runPiProcess'

export interface FakePiRun {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string | undefined
  stdin: string
}

export interface FakePiScript {
  /** stdout lines pi "prints" (each gets a newline). */
  readonly lines?: readonly string[]
  readonly exitCode?: number
  readonly stderr?: string
  /** Emit a spawn error (e.g. ENOENT) instead of running. */
  readonly spawnError?: Error
  /** Never exit on its own; only a kill ends the process. */
  readonly hang?: boolean
  /** Called synchronously when pi is spawned (e.g. to inspect temp files). */
  readonly onSpawn?: (run: FakePiRun) => void
}

/** Build a fake `spawn` that behaves like `pi --mode json` for a given script. */
export function fakePiSpawn(script: FakePiScript): { spawn: SpawnFn; runs: FakePiRun[] } {
  const runs: FakePiRun[] = []

  const spawn = ((command: string, args: readonly string[], options: { cwd?: string }) => {
    const run: FakePiRun = { command, args: [...args], cwd: options?.cwd, stdin: '' }
    runs.push(run)
    script.onSpawn?.(run)

    const child = new EventEmitter() as ChildProcess & EventEmitter
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const state = { exitCode: null as number | null, signalCode: null as NodeJS.Signals | null }

    const finish = (code: number | null, signal: NodeJS.Signals | null) => {
      if (state.exitCode !== null || state.signalCode !== null) return
      state.exitCode = code
      state.signalCode = signal
      stdout.end()
      stderr.end()
      setImmediate(() => child.emit('close', code, signal))
    }

    const stdin = new Writable({
      write(chunk, _enc, cb) {
        run.stdin += chunk.toString()
        cb()
      },
      final(cb) {
        cb()
        if (script.spawnError || script.hang) return
        setImmediate(() => {
          for (const line of script.lines ?? []) stdout.write(`${line}\n`)
          if (script.stderr) stderr.write(script.stderr)
          finish(script.exitCode ?? 0, null)
        })
      },
    })

    Object.defineProperties(child, {
      stdin: { value: stdin },
      stdout: { value: stdout },
      stderr: { value: stderr },
      exitCode: { get: () => state.exitCode },
      signalCode: { get: () => state.signalCode },
    })
    child.kill = ((signal: NodeJS.Signals = 'SIGTERM') => {
      finish(null, signal)
      return true
    }) as ChildProcess['kill']

    if (script.spawnError) {
      const err = script.spawnError
      setImmediate(() => {
        child.emit('error', err)
        finish(-2, null)
      })
    }

    return child
  }) as unknown as SpawnFn

  return { spawn, runs }
}

export const piLines = {
  delta: (text: string) =>
    JSON.stringify({
      type: 'message_update',
      usage: {},
      assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: text },
    }),
  assistantEnd: (text: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      type: 'message_end',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text }],
        provider: 'kiro',
        model: 'claude-haiku-4-5',
        usage: { input: 12, output: 3 },
        stopReason: 'stop',
        ...extra,
      },
    }),
  userEnd: (text: string) =>
    JSON.stringify({
      type: 'message_end',
      message: { role: 'user', content: [{ type: 'text', text }] },
    }),
  session: () => JSON.stringify({ type: 'session', version: 3, id: 'x' }),
}
