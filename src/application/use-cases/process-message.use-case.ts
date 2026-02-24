import type { WhatsAppMessage } from '../../domain/entities/whatsapp-message.entity'
import type { DedupPort } from '../../domain/ports/dedup.port'
import type { IngestPort } from '../../domain/ports/ingest.port'
import { logger } from '../../shared/logger'

export class ProcessMessageUseCase {
  constructor(
    private readonly ingest: IngestPort,
    private readonly dedup: DedupPort,
  ) {}

  async execute(message: WhatsAppMessage): Promise<string | null> {
    if (this.dedup.isDuplicate(message.id)) {
      logger.debug('Skipping duplicate message', { messageId: message.id })
      return null
    }

    this.dedup.markSeen(message.id)

    logger.info('Processing message', {
      messageId: message.id,
      preview: message.body.slice(0, 80),
    })

    return this.ingest.ingest(message)
  }
}
