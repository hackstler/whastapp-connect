import type { WhatsAppMessage } from '../entities/whatsapp-message.entity'

export interface DocumentAttachment {
  base64: string
  mimetype: string
  filename: string
}

export interface BackboneResponse {
  reply?: string
  document?: DocumentAttachment
}

export interface BackbonePort {
  /** Sends the message to the backbone. Returns the agent response or null if unavailable. */
  sendMessage(userId: string, message: WhatsAppMessage): Promise<BackboneResponse | null>

  /** Reports a pairing code to the backbone so the frontend can display it. */
  reportPairingCode(userId: string, code: string): Promise<void>
}
