import fs from 'node:fs'
import path from 'node:path'

import type { Config } from '../../shared/config'
import { logger } from '../../shared/logger'
import { BackboneClient } from '../http/backbone.client'
import { LruDedupCache } from '../cache/lru-dedup.cache'
import { ProcessMessageUseCase } from '../../application/use-cases/process-message.use-case'
import { WhatsAppListenerClient } from '../whatsapp/whatsapp-client'

interface UserSession {
  userId: string
  orgId: string
  whatsapp: WhatsAppListenerClient
  /** Timestamp when the session entered a dead state (not ready, no QR). Used by zombie detection. */
  deadSince?: number
  /** Timestamp when the session first showed a QR without connecting. Used by QR timeout. */
  qrSince?: number
}

export class SessionManager {
  private readonly sessions = new Map<string, UserSession>()
  private readonly backbone: BackboneClient
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private zombieTimer: ReturnType<typeof setInterval> | null = null

  /** Tracks how many consecutive polls each userId has been missing from backbone */
  private readonly backboneMissCount = new Map<string, number>()
  /** Guards teardown — prevents syncSessions from recreating a session mid-teardown */
  private readonly tearingDown = new Set<string>()

  constructor(private readonly config: Config) {
    this.backbone = new BackboneClient(config.BACKBONE_URL, config.JWT_SECRET)
  }

  async start(): Promise<void> {
    // Migrate legacy single-org session layout to per-user layout.
    // Old: SESSION_BASE_PATH/session/  →  New: SESSION_BASE_PATH/<userId>/session/
    await this.migrateLegacySession()

    // Initial sync
    await this.syncSessions()

    // Poll for new sessions
    this.pollTimer = setInterval(() => {
      void this.syncSessions()
    }, this.config.SESSION_POLL_INTERVAL_MS)

    // Heartbeat: re-report ONLY connected sessions every 30s.
    // QR sessions are NOT heartbeated — they should expire via backbone stale cleanup
    // if nobody scans them within 5 minutes.
    this.heartbeatTimer = setInterval(() => {
      for (const session of this.sessions.values()) {
        if (session.whatsapp.isReady) {
          void this.backbone.reportStatus(session.userId, 'connected')
        }
      }
    }, 30_000)

    // Zombie detector: catch sessions stuck in limbo (not ready, no QR)
    this.zombieTimer = setInterval(() => {
      this.checkForZombies()
    }, 60_000)

    logger.info('SessionManager started', {
      sessionCount: this.sessions.size,
      pollIntervalMs: this.config.SESSION_POLL_INTERVAL_MS,
    })
  }

  async stop(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.zombieTimer) clearInterval(this.zombieTimer)

    logger.info('Stopping all user sessions...', { sessionCount: this.sessions.size })

    const stopPromises = Array.from(this.sessions.values()).map(async (session) => {
      try {
        await session.whatsapp.stop()
        logger.info('User session stopped', { userId: session.userId, orgId: session.orgId })
      } catch (error) {
        logger.error('Error stopping user session', { userId: session.userId, orgId: session.orgId, error })
      }
    })

    await Promise.all(stopPromises)
    this.sessions.clear()
  }

  /**
   * Tears down a single user session: removes from map, destroys Chromium, frees RAM.
   * Safe to call multiple times — the tearingDown guard prevents re-entry.
   */
  async teardownSession(userId: string, reason: string): Promise<void> {
    if (this.tearingDown.has(userId)) return
    this.tearingDown.add(userId)

    const session = this.sessions.get(userId)
    if (!session) {
      this.tearingDown.delete(userId)
      return
    }

    // Remove from map BEFORE calling stop() to prevent syncSessions from seeing it
    this.sessions.delete(userId)
    this.backboneMissCount.delete(userId)

    logger.info('Tearing down session', { userId, reason })

    try {
      await session.whatsapp.stop()
      logger.info('Session torn down successfully', { userId, reason })
    } catch (error) {
      logger.error('Error during session teardown', { userId, reason, error })
    } finally {
      this.tearingDown.delete(userId)
    }
  }

  /**
   * Detects zombie sessions: sessions that are neither ready nor showing a QR
   * for longer than ZOMBIE_TIMEOUT_MS. This catches edge cases like initialize()
   * hanging, lost events, etc.
   */
  private checkForZombies(): void {
    const now = Date.now()
    const QR_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes of QR without connecting → teardown

    for (const [userId, session] of this.sessions) {
      if (session.whatsapp.isReady) {
        // Connected — reset all timers
        session.deadSince = undefined
        session.qrSince = undefined
        continue
      }

      // QR/code timeout: session showing QR or pairing code for too long without connecting
      if (session.whatsapp.currentQr || session.whatsapp.currentPairingCode) {
        if (!session.qrSince) {
          session.qrSince = now
        } else if (now - session.qrSince > QR_TIMEOUT_MS) {
          logger.warn('Linking timeout — session showing QR/code too long without connecting', {
            userId,
            qrForMs: now - session.qrSince,
          })
          void this.backbone.reportStatus(session.userId, 'disconnected')
          void this.teardownSession(userId, 'Linking timeout: not connected within 5 minutes')
        }
        continue
      }

      // Dead state: not ready, no QR
      if (!session.deadSince) {
        session.deadSince = now
        continue
      }

      if (now - session.deadSince > this.config.ZOMBIE_TIMEOUT_MS) {
        logger.warn('Zombie session detected', {
          userId,
          deadForMs: now - session.deadSince,
        })
        void this.teardownSession(userId, 'zombie: not ready and no QR')
      }
    }
  }

  async syncSessions(): Promise<void> {
    const entries = await this.backbone.getSessions()

    // Empty list = backbone might be down — don't touch anything
    if (entries.length === 0) {
      logger.warn('No sessions returned from backbone — skipping sync')
      return
    }

    const backboneUserIds = new Set(entries.map((e) => e.userId))

    // Start sessions for new users (sequentially to avoid launching N Chromiums at once)
    for (const { userId, orgId, linkingMethod, phoneNumber } of entries) {
      // Reset miss counter — user is present in backbone
      this.backboneMissCount.delete(userId)

      if (this.sessions.has(userId) || this.tearingDown.has(userId)) continue

      if (this.sessions.size >= this.config.MAX_SESSIONS) {
        logger.warn('Max sessions reached, skipping new session', { userId, max: this.config.MAX_SESSIONS })
        continue
      }
      await this.startUserSession(userId, orgId, linkingMethod, phoneNumber)
    }

    // Detect sessions that disappeared from backbone
    for (const userId of this.sessions.keys()) {
      if (backboneUserIds.has(userId)) continue

      const count = (this.backboneMissCount.get(userId) ?? 0) + 1
      this.backboneMissCount.set(userId, count)

      if (count >= this.config.BACKBONE_MISS_THRESHOLD) {
        logger.warn('User missing from backbone, tearing down', { userId, missCount: count })
        void this.teardownSession(userId, `backbone miss (${count} consecutive polls)`)
      } else {
        logger.debug('User missing from backbone', { userId, missCount: count, threshold: this.config.BACKBONE_MISS_THRESHOLD })
      }
    }
  }

  /**
   * Migrate legacy single-org session to per-user layout.
   * Old layout: SESSION_BASE_PATH/session/
   * New layout: SESSION_BASE_PATH/<userId>/session/
   *
   * Detects the first user session from the backbone and moves the old session there.
   * Only runs once — if the old path doesn't exist, it's a no-op.
   */
  private async migrateLegacySession(): Promise<void> {
    const oldSessionDir = path.join(this.config.SESSION_BASE_PATH, 'session')
    if (!fs.existsSync(oldSessionDir)) return

    // Ask backbone which sessions exist to find the right target
    const entries = await this.backbone.getSessions()
    if (entries.length === 0) {
      logger.warn('[migration] Legacy session found but no sessions from backbone — skipping migration')
      return
    }

    // Use first user (in practice this is the only user before per-user sessions)
    const { userId: targetUserId } = entries[0]!
    const newUserDir = path.join(this.config.SESSION_BASE_PATH, targetUserId)
    const newSessionDir = path.join(newUserDir, 'session')

    if (fs.existsSync(newSessionDir)) {
      logger.info('[migration] New session dir already exists — skipping', { targetUserId })
      return
    }

    fs.mkdirSync(newUserDir, { recursive: true })
    fs.renameSync(oldSessionDir, newSessionDir)
    logger.info('[migration] Migrated legacy session', { from: oldSessionDir, to: newSessionDir, userId: targetUserId })
  }

  private async startUserSession(
    userId: string,
    orgId: string,
    linkingMethod?: 'qr' | 'code',
    phoneNumber?: string,
  ): Promise<void> {
    logger.info('Starting user session', { userId, orgId, linkingMethod })

    try {
      const sessionPath = path.join(this.config.SESSION_BASE_PATH, userId)
      const dedup = new LruDedupCache(this.config.DEDUP_MAX_SIZE, this.config.DEDUP_TTL_MS)
      const processMessage = new ProcessMessageUseCase(userId, this.backbone, dedup)
      const onSessionDead = (uid: string, reason: string) => {
        void this.teardownSession(uid, reason)
      }
      const whatsapp = new WhatsAppListenerClient(userId, orgId, sessionPath, processMessage, this.backbone, onSessionDead, linkingMethod, phoneNumber)

      this.sessions.set(userId, { userId, orgId, whatsapp })
      await whatsapp.start()

      logger.info('User session started', { userId, orgId })
    } catch (error) {
      logger.error('Failed to start user session', { userId, orgId, error })
      this.sessions.delete(userId)
    }
  }
}
