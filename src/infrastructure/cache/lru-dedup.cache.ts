import { LRUCache } from 'lru-cache'

import type { DedupPort } from '../../domain/ports/dedup.port'

export class LruDedupCache implements DedupPort {
  private readonly cache: LRUCache<string, true>

  constructor(max: number, ttlMs: number) {
    this.cache = new LRUCache<string, true>({ max, ttl: ttlMs })
  }

  isDuplicate(id: string): boolean {
    return this.cache.has(id)
  }

  markSeen(id: string): void {
    this.cache.set(id, true)
  }
}
