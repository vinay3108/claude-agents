import { spawn as nodeSpawn } from 'child_process'
import { createInterface } from 'readline'
import { PiProviderError } from './PiProviderError'

export type SpawnFn = typeof nodeSpawn

export interface PiProcessOptions {
  readonly command: string
  readonly args: readonly string[]
  /** Prompt text. Sent on stdin so text that starts with `@` is not read as a file path. */
  readonly stdin: string
  readonly cwd: string
  readonly timeoutMs: number
}

const STDERR_TAIL_CHARS = 2_000

/**
 * Run `pi` and yield its stdout one line at a time.
 *
 * The child stops when it exits, when the timeout expires, or when the consumer
 * stops iterating early (for example, a client disconnect during streaming).
 * A non-zero exit code or a timeout raises a PiProviderError.
 */
export async function* runPiProcess(
  options: PiProcessOptions,
  spawn: SpawnFn = nodeSpawn,
): AsyncGenerator<string> {
  const child = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  })

  let stderr = ''
  child.stderr?.setEncoding('utf8')
  child.stderr?.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-STDERR_TAIL_CHARS)
  })

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
  }, options.timeoutMs)

  const exit = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code))
  })
  // Keep a rejected `exit` from becoming an unhandled rejection before we await it.
  exit.catch(() => undefined)

  child.stdin?.on('error', () => undefined) // EPIPE if pi exits before reading stdin
  child.stdin?.end(options.stdin)

  try {
    if (child.stdout) {
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
      for await (const line of lines) {
        if (line.trim()) {
          yield line
        }
      }
    }

    const code = await exit.catch((err: unknown) => {
      throw new PiProviderError(`Failed to start pi (${options.command}): ${describe(err)}`)
    })
    if (timedOut) {
      throw new PiProviderError(`pi timed out after ${options.timeoutMs} ms`)
    }
    if (code !== 0) {
      throw new PiProviderError(`pi exited with code ${code}: ${stderr.trim() || 'no stderr'}`)
    }
  } finally {
    clearTimeout(timer)
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
    }
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
