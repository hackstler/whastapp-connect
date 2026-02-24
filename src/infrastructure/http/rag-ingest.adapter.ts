import type { WhatsAppMessage } from '../../domain/entities/whatsapp-message.entity'
import type { IngestPort } from '../../domain/ports/ingest.port'
import { logger } from '../../shared/logger'

export class RagIngestAdapter implements IngestPort {
  /** conversationId persistido en memoria por chatId para mantener el hilo */
  private readonly conversationIds = new Map<string, string>()

  constructor(
    private readonly chatUrl: string,
    private readonly apiKey?: string,
  ) {}

  async ingest(message: WhatsAppMessage): Promise<string | null> {
    const orgId = `whatsapp-${message.chatId}`
    const conversationId = this.conversationIds.get(message.chatId)

    const body: Record<string, string> = { query: message.body, orgId }
    if (conversationId !== undefined) {
      body['conversationId'] = conversationId
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['X-API-Key'] = this.apiKey

    const response = await fetch(this.chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      logger.warn('Chat endpoint returned non-OK', {
        status: response.status,
        messageId: message.id,
      })
      return null
    }

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
}
