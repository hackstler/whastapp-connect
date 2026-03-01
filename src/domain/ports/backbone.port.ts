import type { WhatsAppMessage } from '../entities/whatsapp-message.entity'

export interface BackbonePort {
  /** Envía el mensaje al backbone. Retorna la respuesta del agente o null si no hay. */
  sendMessage(userId: string, message: WhatsAppMessage): Promise<string | null>
}
