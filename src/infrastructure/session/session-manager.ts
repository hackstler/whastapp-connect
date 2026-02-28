import fs from 'node:fs'
import path from 'node:path'

import type { Config } from '../../shared/config'
import { logger } from '../../shared/logger'
import { BackboneClient } from '../http/backbone.client'
import { LruDedupCache } from '../cache/lru-dedup.cache'
import { ProcessMessageUseCase } from '../../application/use-cases/process-message.use-case'
import { WhatsAppListenerClient } from '../whatsapp/whatsapp-client'

interface OrgSession {
  orgId: string
  whatsapp: WhatsAppListenerClient
}

export class SessionManager {
  private readonly sessions = new Map<string, OrgSession>()
  private readonly backbone: BackboneClient
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly config: Config) {
    this.backbone = new BackboneClient(config.BACKBONE_URL, config.JWT_SECRET)
  }

  async start(): Promise<void> {
    // Migrate legacy single-org session layout to multi-org layout.
    // Old: SESSION_BASE_PATH/session/  →  New: SESSION_BASE_PATH/<orgId>/session/
    await this.migrateLegacySession()

    // Initial sync
    await this.syncOrgs()

    // Poll for new orgs
    this.pollTimer = setInterval(() => {
      void this.syncOrgs()
    }, this.config.ORG_POLL_INTERVAL_MS)

    // Heartbeat: re-report current status every 30s
    this.heartbeatTimer = setInterval(() => {
      for (const session of this.sessions.values()) {
        if (session.whatsapp.isReady) {
          void this.backbone.reportStatus(session.orgId, 'connected')
        } else if (session.whatsapp.currentQr) {
          void this.backbone.reportQr(session.orgId, session.whatsapp.currentQr)
        }
      }
    }, 30_000)

    logger.info('SessionManager started', {
      orgCount: this.sessions.size,
      pollIntervalMs: this.config.ORG_POLL_INTERVAL_MS,
    })
  }

  async stop(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)

    logger.info('Stopping all org sessions...', { orgCount: this.sessions.size })

    const stopPromises = Array.from(this.sessions.values()).map(async (session) => {
      try {
        await session.whatsapp.stop()
        logger.info('Org session stopped', { orgId: session.orgId })
      } catch (error) {
        logger.error('Error stopping org session', { orgId: session.orgId, error })
      }
    })

    await Promise.all(stopPromises)
    this.sessions.clear()
  }

  async syncOrgs(): Promise<void> {
    const orgIds = await this.backbone.getOrgs()

    if (orgIds.length === 0) {
      logger.warn('No orgs returned from backbone')
      return
    }

    // Start sessions for new orgs (sequentially to avoid launching N Chromiums at once)
    for (const orgId of orgIds) {
      if (!this.sessions.has(orgId)) {
        await this.startOrgSession(orgId)
      }
    }

    // NOTE: we intentionally do NOT tear down orgs that disappeared from the list.
    // This prevents accidental disconnections if the backbone DB has a transient issue.
  }

  /**
   * Migrate legacy single-org session to multi-org layout.
   * Old layout: SESSION_BASE_PATH/session/
   * New layout: SESSION_BASE_PATH/<orgId>/session/
   *
   * Detects the first org from the backbone and moves the old session there.
   * Only runs once — if the old path doesn't exist, it's a no-op.
   */
  private async migrateLegacySession(): Promise<void> {
    const oldSessionDir = path.join(this.config.SESSION_BASE_PATH, 'session')
    if (!fs.existsSync(oldSessionDir)) return

    // Ask backbone which orgs exist to find the right target
    const orgIds = await this.backbone.getOrgs()
    if (orgIds.length === 0) {
      logger.warn('[migration] Legacy session found but no orgs from backbone — skipping migration')
      return
    }

    // Use first org (in practice this is "hackstler" — the only org before multi-org)
    const targetOrg = orgIds[0]!
    const newOrgDir = path.join(this.config.SESSION_BASE_PATH, targetOrg)
    const newSessionDir = path.join(newOrgDir, 'session')

    if (fs.existsSync(newSessionDir)) {
      logger.info('[migration] New session dir already exists — skipping', { targetOrg })
      return
    }

    fs.mkdirSync(newOrgDir, { recursive: true })
    fs.renameSync(oldSessionDir, newSessionDir)
    logger.info('[migration] Migrated legacy session', { from: oldSessionDir, to: newSessionDir, orgId: targetOrg })
  }

  private async startOrgSession(orgId: string): Promise<void> {
    logger.info('Starting org session', { orgId })

    try {
      const sessionPath = path.join(this.config.SESSION_BASE_PATH, orgId)
      const dedup = new LruDedupCache(this.config.DEDUP_MAX_SIZE, this.config.DEDUP_TTL_MS)
      const processMessage = new ProcessMessageUseCase(orgId, this.backbone, dedup)
      const whatsapp = new WhatsAppListenerClient(orgId, sessionPath, processMessage, this.backbone)

      this.sessions.set(orgId, { orgId, whatsapp })
      await whatsapp.start()

      logger.info('Org session started', { orgId })
    } catch (error) {
      logger.error('Failed to start org session', { orgId, error })
      this.sessions.delete(orgId)
    }
  }
}
