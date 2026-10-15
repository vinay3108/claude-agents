import { randomUUID } from 'crypto'
import { createLinkedInConnection } from '@/domain/entities/LinkedInConnection'
import type { LinkedInConnection } from '@/domain/entities/LinkedInConnection'
import type { ILinkedInConnectionRepository } from '@/domain/repositories/ILinkedInConnectionRepository'
import type { LinkedInOAuthClient } from '@/infrastructure/linkedin/LinkedInOAuthClient'
import { AppError } from '@/shared/errors/AppError'

export interface ConnectLinkedInInput {
  readonly userId: string
  readonly code: string
  readonly nonce: string
}

/** Finish "Sign in with LinkedIn": exchange the code and store the profile for this user. */
export class ConnectLinkedInAccount {
  constructor(
    private readonly repo: ILinkedInConnectionRepository,
    private readonly client: Pick<LinkedInOAuthClient, 'exchangeCodeForIdentity'>,
  ) {}

  async execute(input: ConnectLinkedInInput): Promise<LinkedInConnection> {
    const identity = await this.client.exchangeCodeForIdentity(input.code, input.nonce)

    const owner = await this.repo.findByLinkedInSub(identity.sub)
    if (owner && owner.userId !== input.userId) {
      throw new AppError(
        'LINKEDIN_ALREADY_LINKED',
        'This LinkedIn account is already connected to another user',
        409,
      )
    }

    const existing = owner ?? (await this.repo.findByUserId(input.userId))
    const now = new Date()
    return this.repo.upsert(
      createLinkedInConnection({
        id: existing?.id ?? randomUUID(),
        userId: input.userId,
        linkedinSub: identity.sub,
        name: identity.name,
        email: identity.email,
        pictureUrl: identity.pictureUrl,
        connectedAt: existing?.connectedAt ?? now,
        updatedAt: now,
      }),
    )
  }
}
