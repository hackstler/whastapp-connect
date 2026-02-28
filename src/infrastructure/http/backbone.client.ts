import jwt from 'jsonwebtoken'

import type { WhatsAppMessage } from '../../domain/entities/whatsapp-message.entity'
import type { BackbonePort } from '../../domain/ports/ingest.port'
import { logger } from '../../shared/logger'

/**
 * HTTP client for the backbone API.
 * Replaces RagAuthClient + RagIngestAdapter with a single class
 * that uses the new /internal/whatsapp/* endpoints.
 */
export class BackboneClient implements BackbonePort {
  private readonly token: string

  constructor(
    private readonly baseUrl: string,
    orgId: string,
    jwtSecret: string,
  ) {
    // Generate a long-lived worker JWT
    this.token = jwt.sign(
      { role: 'worker', orgId },
      jwtSecret,
    )
    logger.info('[backbone] Worker JWT generated', { orgId })
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    }
  }

  /**
   * Report a QR code to the backbone.
   * POST /internal/whatsapp/qr
   */
  async reportQr(qrData: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/whatsapp/qr`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ qrData }),
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) {
        logger.warn('[backbone] reportQr failed', { status: res.status })
      }
    } catch (error) {
      logger.error('[backbone] reportQr error', { error })
    }
  }

  /**
   * Report connection status change to the backbone.
   * POST /internal/whatsapp/status
   */
  async reportStatus(status: 'connected' | 'disconnected', phone?: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/whatsapp/status`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ status, ...(phone ? { phone } : {}) }),
        signal: AbortSignal.timeout(5_000),
      })
      if (!res.ok) {
        logger.warn('[backbone] reportStatus failed', { status: res.status })
      }
    } catch (error) {
      logger.error('[backbone] reportStatus error', { error })
    }
  }

  /**
   * Send a WhatsApp message to the backbone for RAG processing.
   * POST /internal/whatsapp/message
   * Returns the agent's reply or null if unavailable.
   */
  async sendMessage(message: WhatsAppMessage): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/internal/whatsapp/message`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          messageId: message.id,
          body: message.body,
          chatId: message.chatId,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!res.ok) {
        logger.warn('[backbone] sendMessage failed', { status: res.status, messageId: message.id })
        return null
      }

      const data = await res.json() as { data?: { reply?: string } }
      return data?.data?.reply ?? null
    } catch (error) {
      logger.error('[backbone] sendMessage error', { error, messageId: message.id })
      return null
    }
  }
}
