import { UserId } from '../value-objects/UserId'

/** A LinkedIn account linked to an app user through "Sign in with LinkedIn" (OIDC). */
export interface LinkedInConnection {
  readonly id: string
  readonly userId: UserId
  /** LinkedIn's stable member id (the OIDC `sub` claim). */
  readonly linkedinSub: string
  readonly name: string
  readonly email: string | null
  readonly pictureUrl: string | null
  readonly connectedAt: Date
  readonly updatedAt: Date
}

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Only https image URLs are kept, so the UI never renders a javascript: or http: source. */
const safeHttpsUrl = (value: string | null | undefined): string | null => {
  const raw = blankToNull(value)
  if (!raw) return null
  try {
    return new URL(raw).protocol === 'https:' ? raw : null
  } catch {
    return null
  }
}

export const createLinkedInConnection = (params: {
  id: string
  userId: string
  linkedinSub: string
  name: string
  email?: string | null
  pictureUrl?: string | null
  connectedAt?: Date
  updatedAt?: Date
}): LinkedInConnection => {
  const linkedinSub = params.linkedinSub.trim()
  if (!linkedinSub) throw new Error('LinkedIn member id is required')
  const name = params.name.trim()
  if (!name) throw new Error('LinkedIn name is required')

  const now = new Date()
  return {
    id: params.id,
    userId: UserId.fromString(params.userId),
    linkedinSub,
    name,
    email: blankToNull(params.email)?.toLowerCase() ?? null,
    pictureUrl: safeHttpsUrl(params.pictureUrl),
    connectedAt: params.connectedAt ?? now,
    updatedAt: params.updatedAt ?? now,
  }
}
