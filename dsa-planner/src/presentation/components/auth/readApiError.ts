/**
 * Get a display message from an API error body (`{ error: { message } }` or
 * `{ error: "..." }`). Anything else gives the fallback text.
 */
export function readApiErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null || !('error' in body)) return fallback
  const { error } = body as { error: unknown }

  const message =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: unknown }).message
        : undefined

  return typeof message === 'string' && message.trim() ? message : fallback
}
