export interface Notice {
  readonly type: 'success' | 'error'
  readonly text: string
}

/** Messages for the `?linkedin=<code>` value the callback route sets. */
const NOTICES: Readonly<Record<string, Notice>> = {
  connected: { type: 'success', text: 'LinkedIn connected.' },
  cancelled: { type: 'error', text: 'LinkedIn sign-in was cancelled.' },
  denied: { type: 'error', text: 'LinkedIn did not allow the connection. Please try again.' },
  expired: { type: 'error', text: 'The LinkedIn sign-in took too long. Please try again.' },
  state: { type: 'error', text: 'The LinkedIn sign-in could not be verified. Please try again.' },
  taken: { type: 'error', text: 'That LinkedIn account is already connected to another account.' },
  unconfigured: { type: 'error', text: 'LinkedIn sign-in is not configured on this server.' },
  error: { type: 'error', text: 'Could not connect LinkedIn. Please try again.' },
}

export function linkedinCallbackNotice(code: string | null): Notice | null {
  if (!code || !Object.hasOwn(NOTICES, code)) return null
  return NOTICES[code] ?? null
}
