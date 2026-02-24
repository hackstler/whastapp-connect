import type { WhatsAppMessage } from '../entities/whatsapp-message.entity'

export interface IngestPort {
  /** Envía el mensaje al backend RAG. Retorna la respuesta del agente o null si no hay. */
  ingest(message: WhatsAppMessage): Promise<string | null>
}
