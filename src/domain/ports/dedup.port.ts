export interface DedupPort {
  isDuplicate(id: string): boolean
  markSeen(id: string): void
}
