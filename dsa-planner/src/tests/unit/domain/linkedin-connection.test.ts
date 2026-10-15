import { describe, expect, it } from 'vitest'
import { createLinkedInConnection } from '@/domain/entities/LinkedInConnection'

const base = {
  id: 'conn-1',
  userId: 'user-1',
  linkedinSub: 'abc123',
  name: '  Ada Lovelace ',
}

describe('createLinkedInConnection', () => {
  it('trims the name and sets defaults', () => {
    const conn = createLinkedInConnection(base)
    expect(conn.name).toBe('Ada Lovelace')
    expect(conn.email).toBeNull()
    expect(conn.pictureUrl).toBeNull()
    expect(conn.connectedAt).toBeInstanceOf(Date)
  })

  it('lowercases the email and drops blank values', () => {
    expect(createLinkedInConnection({ ...base, email: ' Ada@Example.COM ' }).email).toBe('ada@example.com')
    expect(createLinkedInConnection({ ...base, email: '  ' }).email).toBeNull()
  })

  it('keeps only https picture URLs', () => {
    expect(createLinkedInConnection({ ...base, pictureUrl: 'https://media.licdn.com/p.jpg' }).pictureUrl).toBe(
      'https://media.licdn.com/p.jpg',
    )
    expect(createLinkedInConnection({ ...base, pictureUrl: 'http://media.licdn.com/p.jpg' }).pictureUrl).toBeNull()
    expect(createLinkedInConnection({ ...base, pictureUrl: 'javascript:alert(1)' }).pictureUrl).toBeNull()
    expect(createLinkedInConnection({ ...base, pictureUrl: 'not a url' }).pictureUrl).toBeNull()
  })

  it('rejects a missing LinkedIn id or name', () => {
    expect(() => createLinkedInConnection({ ...base, linkedinSub: ' ' })).toThrow('LinkedIn member id is required')
    expect(() => createLinkedInConnection({ ...base, name: '' })).toThrow('LinkedIn name is required')
  })

  it('rejects an empty user id', () => {
    expect(() => createLinkedInConnection({ ...base, userId: '' })).toThrow('UserId cannot be empty')
  })
})
