import jwt from 'jsonwebtoken'

import type { WhatsAppMessage } from '../../domain/entities/whatsapp-message.entity'
import type { BackbonePort } from '../../domain/ports/ingest.port'
import { logger } from '../../shared/logger'

/**
 * HTTP client for the backbone API.
 * System-level JWT (no orgId) — orgId is passed per-call in the request body.
 */
export class BackboneClient implements BackbonePort {
  private readonly token: string

  constructor(
    private readonly baseUrl: string,
    jwtSecret: string,
  ) {
    // Generate a system-level worker JWT (no orgId — multi-org)
    this.token = jwt.sign({ role: 'worker' }, jwtSecret)
    logger.info('[backbone] System worker JWT generated')
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    }
  }

  /**
   * Fetch the list of org IDs from the backbone.
   * GET /internal/whatsapp/orgs
   */
  async getOrgs(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/whatsapp/orgs`, {
        method: 'GET',
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        logger.warn('[backbone] getOrgs failed', { status: res.status })
        return []
      }
      const data = await res.json() as { data?: string[] }
      return data?.data ?? []
    } catch (error) {
      logger.error('[backbone] getOrgs error', { error })
      return []
    }
  }

  /**
   * Report a QR code to the backbone.
   * POST /internal/whatsapp/qr
   */
  async reportQr(orgId: string, qrData: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/whatsapp/qr`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ qrData, orgId }),
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) {
        logger.warn('[backbone] reportQr failed', { orgId, status: res.status })
      }
    } catch (error) {
      logger.error('[backbone] reportQr error', { orgId, error })
    }
  }

  /**
   * Report connection status change to the backbone.
   * POST /internal/whatsapp/status
   */
  async reportStatus(orgId: string, status: 'connected' | 'disconnected', phone?: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/whatsapp/status`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ status, orgId, ...(phone ? { phone } : {}) }),
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) {
        logger.warn('[backbone] reportStatus failed', { orgId, status: res.status })
      }
    } catch (error) {
      logger.error('[backbone] reportStatus error', { orgId, error })
    }
  }

  /**
   * Send a WhatsApp message to the backbone for RAG processing.
   * POST /internal/whatsapp/message
   * Returns the agent's reply or null if unavailable.
   */
  async sendMessage(orgId: string, message: WhatsAppMessage): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/whatsapp/message`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          messageId: message.id,
          body: message.body,
          chatId: message.chatId,
          orgId,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        logger.warn('[backbone] sendMessage failed', { orgId, status: res.status, messageId: message.id })
        return null
      }

      const data = await res.json() as { data?: { reply?: string } }
      return data?.data?.reply ?? null
    } catch (error) {
      logger.error('[backbone] sendMessage error', { orgId, error, messageId: message.id })
      return null
    }
  }
}
