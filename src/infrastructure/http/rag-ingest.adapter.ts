import type { WhatsAppMessage } from '../../domain/entities/whatsapp-message.entity'
import type { IngestPort } from '../../domain/ports/ingest.port'
import { logger } from '../../shared/logger'
import type { RagAuthClient } from './rag-auth.client'

export class RagIngestAdapter implements IngestPort {
  /** conversationId persistido en memoria por chatId para mantener el hilo */
  private readonly conversationIds = new Map<string, string>()

  constructor(
    private readonly chatUrl: string,
    private readonly auth: RagAuthClient,
  ) {}

  async ingest(message: WhatsAppMessage): Promise<string | null> {
    const orgId = `whatsapp-${message.chatId}`
    const conversationId = this.conversationIds.get(message.chatId)

    const body: Record<string, string> = { query: message.body, orgId }
    if (conversationId !== undefined) {
      body['conversationId'] = conversationId
    }

    const response = await this.fetchWithAuth(this.chatUrl, {
      method: 'POST',
      body: JSON.stringify(body),
    })

    if (!response) return null

    try {
      const data = await response.json() as Record<string, unknown>

      if (typeof data['conversationId'] === 'string') {
        this.conversationIds.set(message.chatId, data['conversationId'])
        logger.debug('conversationId actualizado', { chatId: message.chatId, conversationId: data['conversationId'] })
      }

      const answer = typeof data['answer'] === 'string' ? data['answer'] : null
      if (!answer) return null

      const sources = Array.isArray(data['sources']) ? data['sources'] as Array<Record<string, unknown>> : []
      const links = sources
        .filter(s => typeof s['documentSource'] === 'string')
        .map((s, i) => {
          const title = typeof s['documentTitle'] === 'string' ? s['documentTitle'] : s['documentSource'] as string
          return `[${i + 1}] ${title}\n${s['documentSource'] as string}`
        })

      const reply = links.length > 0 ? `${answer}\n\n📚 Fuentes:\n${links.join('\n\n')}` : answer

      logger.debug('Message sent to chat endpoint', { messageId: message.id, status: response.status })
      return reply
    } catch {
      logger.warn('No se pudo parsear la respuesta del chat endpoint', { messageId: message.id })
      return null
    }
  }

  /**
   * fetch con auth automática. Si el servidor devuelve 401, re-login y reintenta una vez.
   * Exportado para que server.ts pueda reutilizarlo en las rutas de ingest.
   */
  async fetchWithAuth(
    url: string,
    init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> },
  ): Promise<Response | null> {
    const authHeaders = await this.auth.getHeaders()
    const headers = { 'Content-Type': 'application/json', ...authHeaders, ...init.headers }

    let response = await fetch(url, { ...init, headers })

    if (response.status === 401) {
      logger.warn('[rag-auth] 401 recibido — re-login y reintento')
      try {
        await this.auth.relogin()
        const retryHeaders = { 'Content-Type': 'application/json', ...await this.auth.getHeaders(), ...init.headers }
        response = await fetch(url, { ...init, headers: retryHeaders })
      } catch (err) {
        logger.error('[rag-auth] Re-login fallido', { err })
        return null
      }
    }

    if (!response.ok) {
      logger.warn('RAG backend returned non-OK', { status: response.status, url })
      return null
    }

    return response
  }
}
