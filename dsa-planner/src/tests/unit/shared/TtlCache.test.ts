import { describe, expect, it, vi } from 'vitest'
import { TtlCache } from '@/shared/utils/TtlCache'

describe('TtlCache', () => {
  it('returns a stored value until it expires', () => {
    let now = 0
    const cache = new TtlCache<string>({ ttlMs: 100, maxEntries: 10, now: () => now })
    cache.set('a', 'one')
    now = 99
    expect(cache.get('a')).toBe('one')
    now = 100
    expect(cache.get('a')).toBeUndefined()
  })

  it('evicts the oldest entry when full', () => {
    const cache = new TtlCache<number>({ ttlMs: 1_000, maxEntries: 2, now: () => 0 })
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // touch "a" so "b" is now the oldest
    cache.set('c', 3)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
  })

  it('getOrLoad calls the loader once and shares in-flight loads', async () => {
    const cache = new TtlCache<string>({ ttlMs: 1_000, maxEntries: 10, now: () => 0 })
    const loader = vi.fn().mockResolvedValue('value')
    const [a, b] = await Promise.all([cache.getOrLoad('k', loader), cache.getOrLoad('k', loader)])
    expect([a, b]).toEqual(['value', 'value'])
    expect(await cache.getOrLoad('k', loader)).toBe('value')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed load', async () => {
    const cache = new TtlCache<string>({ ttlMs: 1_000, maxEntries: 10, now: () => 0 })
    const loader = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('ok')
    await expect(cache.getOrLoad('k', loader)).rejects.toThrow('down')
    expect(await cache.getOrLoad('k', loader)).toBe('ok')
  })

  it('deletes a key', () => {
    const cache = new TtlCache<string>({ ttlMs: 1_000, maxEntries: 10, now: () => 0 })
    cache.set('a', 'x')
    cache.delete('a')
    expect(cache.get('a')).toBeUndefined()
  })
})
