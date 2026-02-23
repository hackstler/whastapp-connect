import { Client, LocalAuth } from 'whatsapp-web.js'
import type { Message } from 'whatsapp-web.js'
import qrTerminal from 'qrcode-terminal'

import type { ProcessMessageUseCase } from '../../application/use-cases/process-message.use-case'
import { logger } from '../../shared/logger'

export class WhatsAppListenerClient {
  private readonly client: Client
  /**
   * JID del propio usuario, p.ej. "521234567890@c.us".
   * Se asigna en el evento 'ready'. Mientras sea null se descartan mensajes.
   */
  private selfChatId: string | null = null

  constructor(
    sessionPath: string,
    private readonly processMessage: ProcessMessageUseCase,
  ) {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    })
    this.registerHandlers()
  }

  private registerHandlers(): void {
    this.client.on('qr', (qr) => {
      qrTerminal.generate(qr, { small: true })
      logger.info('QR generado — escanea con WhatsApp móvil')
    })

    this.client.on('ready', () => {
      const info = this.client.info
      this.selfChatId = info.wid._serialized
      logger.info('WhatsApp client listo', { selfChatId: this.selfChatId })
    })

    /**
     * message_create: se dispara para TODOS los mensajes que tú escribes,
     * en cualquier chat. Filtramos solo el self-chat (msg.to === selfChatId).
     */
    this.client.on('message_create', (msg: Message) => {
      void this.handleOutgoing(msg)
    })

    this.client.on('disconnected', (reason) => {
      logger.warn('WhatsApp desconectado', { reason })
    })

    this.client.on('auth_failure', (message) => {
      logger.error('Fallo de autenticación WhatsApp', { message })
    })
  }

  private async handleOutgoing(msg: Message): Promise<void> {
    if (!msg.fromMe) return
    if (!this.isSelfChat(msg)) return
    if (!msg.body.trim()) return

    const message = {
      id: msg.id._serialized,
      body: msg.body,
      timestamp: msg.timestamp,
      chatId: msg.from,
      fromMe: msg.fromMe,
    }

    try {
      await this.processMessage.execute(message)
    } catch (error) {
      logger.error('Error procesando mensaje', { error, messageId: msg.id._serialized })
    }
  }

  /**
   * Un mensaje es del chat "Message Yourself" cuando
   * tú eres el emisor Y el destinatario es tu propio JID.
   */
  private isSelfChat(msg: Message): boolean {
    if (this.selfChatId === null) return false
    return msg.to === this.selfChatId
  }

  async start(): Promise<void> {
    logger.info('Iniciando WhatsApp client...')
    await this.client.initialize()
  }

  async stop(): Promise<void> {
    logger.info('Deteniendo WhatsApp client...')
    await this.client.destroy()
  }
}
