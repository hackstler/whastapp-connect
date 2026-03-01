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
}

export class SessionManager {
  private readonly sessions = new Map<string, UserSession>()
  private readonly backbone: BackboneClient
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

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

    // Heartbeat: re-report current status every 30s
    this.heartbeatTimer = setInterval(() => {
      for (const session of this.sessions.values()) {
        if (session.whatsapp.isReady) {
          void this.backbone.reportStatus(session.userId, 'connected')
        } else if (session.whatsapp.currentQr) {
          void this.backbone.reportQr(session.userId, session.whatsapp.currentQr)
        }
      }
    }, 30_000)

    logger.info('SessionManager started', {
      sessionCount: this.sessions.size,
      pollIntervalMs: this.config.SESSION_POLL_INTERVAL_MS,
    })
  }

  async stop(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)

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

  async syncSessions(): Promise<void> {
    const entries = await this.backbone.getSessions()

    if (entries.length === 0) {
      logger.warn('No sessions returned from backbone')
      return
    }

    // Start sessions for new users (sequentially to avoid launching N Chromiums at once)
    for (const { userId, orgId } of entries) {
      if (!this.sessions.has(userId)) {
        await this.startUserSession(userId, orgId)
      }
    }

    // NOTE: we intentionally do NOT tear down sessions that disappeared from the list.
    // This prevents accidental disconnections if the backbone DB has a transient issue.
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

  private async startUserSession(userId: string, orgId: string): Promise<void> {
    logger.info('Starting user session', { userId, orgId })

    try {
      const sessionPath = path.join(this.config.SESSION_BASE_PATH, userId)
      const dedup = new LruDedupCache(this.config.DEDUP_MAX_SIZE, this.config.DEDUP_TTL_MS)
      const processMessage = new ProcessMessageUseCase(userId, this.backbone, dedup)
      const whatsapp = new WhatsAppListenerClient(userId, orgId, sessionPath, processMessage, this.backbone)

      this.sessions.set(userId, { userId, orgId, whatsapp })
      await whatsapp.start()

      logger.info('User session started', { userId, orgId })
    } catch (error) {
      logger.error('Failed to start user session', { userId, orgId, error })
      this.sessions.delete(userId)
    }
  }
}
