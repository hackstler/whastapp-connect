import type { WhatsAppMessage } from '../../domain/entities/whatsapp-message.entity'
import type { IngestPort } from '../../domain/ports/ingest.port'
import { logger } from '../../shared/logger'

export class RagIngestAdapter implements IngestPort {
  constructor(private readonly ingestUrl: string) {}

  async ingest(message: WhatsAppMessage): Promise<void> {
    const response = await fetch(this.ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: message.id,
        text: message.body,
        timestamp: message.timestamp,
        source: 'whatsapp',
        chatId: message.chatId,
      }),
    })

    if (!response.ok) {
      logger.warn('Ingest endpoint returned non-OK', {
        status: response.status,
        messageId: message.id,
      })
    } else {
      logger.debug('Message ingested', { messageId: message.id, status: response.status })
    }
  }
}
