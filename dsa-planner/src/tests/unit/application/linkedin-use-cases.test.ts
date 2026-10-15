import { describe, expect, it, vi } from 'vitest'
import { ConnectLinkedInAccount } from '@/application/use-cases/linkedin/ConnectLinkedInAccount'
import { DisconnectLinkedInAccount } from '@/application/use-cases/linkedin/DisconnectLinkedInAccount'
import { GetLinkedInConnection } from '@/application/use-cases/linkedin/GetLinkedInConnection'
import type { LinkedInConnection } from '@/domain/entities/LinkedInConnection'
import { createLinkedInConnection } from '@/domain/entities/LinkedInConnection'
import type { ILinkedInConnectionRepository } from '@/domain/repositories/ILinkedInConnectionRepository'
import type { LinkedInIdentity, LinkedInOAuthClient } from '@/infrastructure/linkedin/LinkedInOAuthClient'
import { AppError } from '@/shared/errors/AppError'

function makeRepo(existing: { byUser?: LinkedInConnection; bySub?: LinkedInConnection } = {}) {
  return {
    findByUserId: vi.fn().mockResolvedValue(existing.byUser ?? null),
    findByLinkedInSub: vi.fn().mockResolvedValue(existing.bySub ?? null),
    upsert: vi.fn().mockImplementation(async (c: LinkedInConnection) => c),
    deleteByUserId: vi.fn().mockResolvedValue(true),
  } satisfies ILinkedInConnectionRepository
}

const identity: LinkedInIdentity = {
  sub: 'li-sub-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  pictureUrl: 'https://media.licdn.com/ada.jpg',
}

function makeClient(result: LinkedInIdentity = identity) {
  return {
    exchangeCodeForIdentity: vi.fn().mockResolvedValue(result),
  } as unknown as LinkedInOAuthClient & { exchangeCodeForIdentity: ReturnType<typeof vi.fn> }
}

describe('ConnectLinkedInAccount', () => {
  it('exchanges the code and saves the profile for the user', async () => {
    const repo = makeRepo()
    const client = makeClient()
    const result = await new ConnectLinkedInAccount(repo, client).execute({
      userId: 'user-1',
      code: 'auth-code',
      nonce: 'n-1',
    })

    expect(client.exchangeCodeForIdentity).toHaveBeenCalledWith('auth-code', 'n-1')
    expect(repo.upsert).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      userId: 'user-1',
      linkedinSub: 'li-sub-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
  })

  it('keeps the existing row id when the user reconnects', async () => {
    const existing = createLinkedInConnection({ id: 'conn-old', userId: 'user-1', linkedinSub: 'li-sub-1', name: 'Old' })
    const repo = makeRepo({ byUser: existing, bySub: existing })
    const result = await new ConnectLinkedInAccount(repo, makeClient()).execute({
      userId: 'user-1',
      code: 'c',
      nonce: 'n',
    })
    expect(result.id).toBe('conn-old')
    expect(result.name).toBe('Ada Lovelace')
  })

  it('refuses a LinkedIn account that belongs to another user', async () => {
    const other = createLinkedInConnection({ id: 'conn-x', userId: 'user-2', linkedinSub: 'li-sub-1', name: 'Ada' })
    const repo = makeRepo({ bySub: other })
    const err = await new ConnectLinkedInAccount(repo, makeClient())
      .execute({ userId: 'user-1', code: 'c', nonce: 'n' })
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).code).toBe('LINKEDIN_ALREADY_LINKED')
    expect(repo.upsert).not.toHaveBeenCalled()
  })
})

describe('GetLinkedInConnection', () => {
  it('returns the connection or null', async () => {
    const conn = createLinkedInConnection({ id: 'c', userId: 'user-1', linkedinSub: 's', name: 'Ada' })
    expect(await new GetLinkedInConnection(makeRepo({ byUser: conn })).execute('user-1')).toBe(conn)
    expect(await new GetLinkedInConnection(makeRepo()).execute('user-1')).toBeNull()
  })
})

describe('DisconnectLinkedInAccount', () => {
  it('deletes the connection for the user', async () => {
    const repo = makeRepo()
    await new DisconnectLinkedInAccount(repo).execute('user-1')
    expect(repo.deleteByUserId).toHaveBeenCalledWith('user-1')
  })

  it('reports not found when there was nothing to remove', async () => {
    const repo = makeRepo()
    repo.deleteByUserId.mockResolvedValue(false)
    await expect(new DisconnectLinkedInAccount(repo).execute('user-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    })
  })
})
