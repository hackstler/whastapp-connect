import { Client, LocalAuth } from 'whatsapp-web.js'
import type { Message } from 'whatsapp-web.js'

import type { ProcessMessageUseCase } from '../../application/use-cases/process-message.use-case'
import { logger } from '../../shared/logger'

export class WhatsAppListenerClient {
  private readonly client: Client
  /**
   * JID del propio usuario, p.ej. "521234567890@c.us".
   * Se asigna en el evento 'ready'. Mientras sea null se descartan mensajes.
   */
  private selfChatId: string | null = null
  /**
   * IDs de mensajes enviados por el bot como respuesta RAG.
   * Se registra el ID devuelto por sendMessage para ignorar el message_create
   * correspondiente. Usar IDs (no bodies) evita falsos positivos cuando
   * el agente repite el mismo texto en respuestas distintas.
   */
  private readonly pendingReplyIds = new Set<string>()

  /** Último QR recibido. null cuando ya está autenticado o aún no ha llegado. */
  public currentQr: string | null = null
  /** true cuando el cliente está listo y conectado a WhatsApp. */
  public isReady = false

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
      this.currentQr = qr
      this.isReady = false
      logger.info('QR generado — abre /qr en el navegador para escanearlo')
    })

    this.client.on('ready', () => {
      const info = this.client.info
      this.selfChatId = info.wid._serialized
      this.currentQr = null
      this.isReady = true
      logger.info('WhatsApp client listo', { selfChatId: this.selfChatId })
    })

    this.client.on('disconnected', (reason) => {
      this.isReady = false
      logger.warn('WhatsApp desconectado', { reason })
    })

    /**
     * message_create: se dispara para TODOS los mensajes que tú escribes,
     * en cualquier chat. Filtramos solo el self-chat (msg.to === selfChatId).
     */
    this.client.on('message_create', (msg: Message) => {
      void this.handleOutgoing(msg)
    })

    this.client.on('auth_failure', (message) => {
      logger.error('Fallo de autenticación WhatsApp', { message })
    })
  }

  private async handleOutgoing(msg: Message): Promise<void> {
    if (!msg.fromMe) return
    if (!this.isSelfChat(msg)) return
    if (!msg.body.trim()) return

    // Ignorar mensajes que el bot envió como respuesta RAG (identificados por ID único)
    if (this.pendingReplyIds.has(msg.id._serialized)) {
      this.pendingReplyIds.delete(msg.id._serialized)
      return
    }

    const message = {
      id: msg.id._serialized,
      body: msg.body,
      timestamp: msg.timestamp,
      chatId: msg.from,
      fromMe: msg.fromMe,
    }

    try {
      const answer = await this.processMessage.execute(message)
      if (answer && this.selfChatId) {
        const sent = await this.client.sendMessage(this.selfChatId, answer)
        this.pendingReplyIds.add(sent.id._serialized)
        logger.debug('Respuesta enviada al self-chat', { messageId: msg.id._serialized, sentId: sent.id._serialized })
      }
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

  /**
   * Cierra la sesión de WhatsApp y borra las credenciales locales.
   * Después de llamar a esto hay que reiniciar el servicio para escanear un QR nuevo.
   */
  async logout(): Promise<void> {
    logger.info('Cerrando sesión de WhatsApp...')
    this.isReady = false
    this.currentQr = null
    try {
      await this.client.logout()
    } catch {
      // logout puede fallar si ya está desconectado; continuar de todas formas
    }
    await this.client.destroy()
    logger.info('Sesión cerrada')
  }
}
