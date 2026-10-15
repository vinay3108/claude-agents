interface Entry<T> {
  readonly value: T
  readonly expiresAt: number
}

export interface TtlCacheOptions {
  readonly ttlMs: number
  /** When full, the least-recently-used entry is evicted. */
  readonly maxEntries: number
  readonly now?: () => number
}

/**
 * Small in-memory cache with TTL expiry and LRU eviction (Map keeps insertion
 * order; reads move an entry to the end). Concurrent loads of one key share a
 * single promise, and failed loads are never cached.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>()
  private readonly inFlight = new Map<string, Promise<T>>()
  private readonly now: () => number

  constructor(private readonly options: TtlCacheOptions) {
    this.now = options.now ?? Date.now
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T): void {
    this.entries.delete(key)
    this.entries.set(key, { value, expiresAt: this.now() + this.options.ttlMs })
    while (this.entries.size > this.options.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  delete(key: string): void {
    this.entries.delete(key)
  }

  async getOrLoad(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.get(key)
    if (cached !== undefined) return cached

    const pending = this.inFlight.get(key)
    if (pending) return pending

    const promise = load()
      .then((value) => {
        this.set(key, value)
        return value
      })
      .finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, promise)
    return promise
  }
}
