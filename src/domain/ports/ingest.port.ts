import type { WhatsAppMessage } from '../entities/whatsapp-message.entity'

export interface IngestPort {
  ingest(message: WhatsAppMessage): Promise<void>
}
