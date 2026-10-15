import { z } from 'zod'
import { apiError, apiOk } from '@/shared/utils/api-response'
import { getCurrentUser } from '@/shared/utils/get-current-user'

const JUDGE0_URL = 'https://ce.judge0.com/submissions?wait=true'

// Judge0 CE language IDs
const LANGUAGE_IDS: Record<string, number> = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
  go: 60,
  typescript: 74,
}

const bodySchema = z.object({
  language: z.string().min(1),
  code: z.string().min(1).max(50_000),
})

interface Judge0Response {
  stdout: string | null
  stderr: string | null
  compile_output: string | null
  status: { id: number; description: string }
  exit_code: number | null
}

export async function POST(request: Request) {
  try {
    await getCurrentUser()

    const body = bodySchema.parse(await request.json())

    const languageId = LANGUAGE_IDS[body.language]
    if (!languageId) {
      throw new Error(`Unsupported language: ${body.language}`)
    }

    const res = await fetch(JUDGE0_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_code: body.code,
        language_id: languageId,
        stdin: '',
      }),
    })

    if (!res.ok) {
      throw new Error(`Execution service error: ${res.status}`)
    }

    const data = (await res.json()) as Judge0Response

    const stderr = data.compile_output
      ? `Compile error:\n${data.compile_output}`
      : (data.stderr ?? '')

    return apiOk({
      stdout: data.stdout ?? '',
      stderr,
      exitCode: data.exit_code ?? (data.status.id === 3 ? 0 : 1),
    })
  } catch (err) {
    return apiError(err)
  }
}
