import type { LinkedInConnection } from '@/domain/entities/LinkedInConnection'

/** What the Settings page needs. Never includes the internal user id or LinkedIn id. */
export interface LinkedInConnectionDto {
  readonly configured: boolean
  readonly connection: {
    readonly name: string
    readonly email: string | null
    readonly pictureUrl: string | null
    readonly connectedAt: string
  } | null
}

export function toLinkedInConnectionDto(
  configured: boolean,
  connection: LinkedInConnection | null,
): LinkedInConnectionDto {
  return {
    configured,
    connection: connection
      ? {
          name: connection.name,
          email: connection.email,
          pictureUrl: connection.pictureUrl,
          connectedAt: connection.connectedAt.toISOString(),
        }
      : null,
  }
}
