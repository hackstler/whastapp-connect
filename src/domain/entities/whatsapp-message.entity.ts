export type WhatsAppMessage = {
  readonly id: string
  readonly body: string
  readonly timestamp: number
  readonly chatId: string
  readonly fromMe: boolean
}
