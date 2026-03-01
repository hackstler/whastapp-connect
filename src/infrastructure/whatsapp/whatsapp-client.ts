import { Client, LocalAuth } from 'whatsapp-web.js'
import type { Message } from 'whatsapp-web.js'

import type { ProcessMessageUseCase } from '../../application/use-cases/process-message.use-case'
import type { BackboneClient } from '../http/backbone.client'
import { ConnectionError } from '../../domain/errors/connection.error'
import { BackboneUnavailableError } from '../../domain/errors/backbone-unavailable.error'
import { logger } from '../../shared/logger'

export class WhatsAppListenerClient {
  private readonly client: Client
  /**
   * JID del propio usuario, p.ej. "521234567890@c.us".
   * Se asigna en el evento 'ready'. Mientras sea null se descartan mensajes.
   */
  private selfChatId: string | null = null

  /** Último QR recibido. null cuando ya está autenticado o aún no ha llegado. */
  public currentQr: string | null = null
  /** true cuando el cliente está listo y conectado a WhatsApp. */
  public isReady = false

  /**
   * Dedup de respuestas enviadas por el bot basado en CUERPO + TTL.
   *
   * En Android multi-device (whatsapp-web.js), el ID que devuelve sendMessage()
   * NO coincide con msg.id.id del evento message_create posterior para el mismo
   * mensaje. El cuerpo del mensaje sí es idéntico en ambos lados, por lo que
   * es la única propiedad fiable para detectar respuestas propias del bot.
   *
   * Map<body, expiresAtMs> — nunca se borra al hacer match, expira por TTL.
   */
  private readonly sentBodies = new Map<string, number>()

  constructor(
    private readonly userId: string,
    private readonly orgId: string,
    sessionPath: string,
    private readonly processMessage: ProcessMessageUseCase,
    private readonly backbone: BackboneClient,
  ) {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer: {
        headless: true,
        executablePath: process.env['PUPPETEER_EXECUTABLE_PATH'],
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    })
    this.registerHandlers()
  }

  private registerHandlers(): void {
    this.client.on('qr', (qr) => {
      this.currentQr = qr
      this.isReady = false
      logger.info('QR generated', { userId: this.userId, orgId: this.orgId })
      // Report QR to backbone so frontend can display it
      void this.backbone.reportQr(this.userId, qr)
    })

    this.client.on('ready', () => {
      const info = this.client.info
      this.selfChatId = info.wid._serialized
      this.currentQr = null
      this.isReady = true
      logger.info('WhatsApp client ready', { userId: this.userId, orgId: this.orgId, selfChatId: this.selfChatId })
      // Report connected status to backbone
      void this.backbone.reportStatus(this.userId, 'connected', info.pushname ?? undefined)
    })

    this.client.on('disconnected', (reason) => {
      this.isReady = false
      logger.warn('WhatsApp disconnected', { userId: this.userId, orgId: this.orgId, reason })
      // Report disconnected status to backbone
      void this.backbone.reportStatus(this.userId, 'disconnected')
    })

    /**
     * message_create: se dispara para TODOS los mensajes que el usuario escribe,
     * en cualquier chat (incluyendo sync de dispositivos vinculados).
     * Filtramos solo el self-chat y excluimos las respuestas del propio bot.
     */
    this.client.on('message_create', (msg: Message) => {
      void this.handleOutgoing(msg)
    })

    this.client.on('auth_failure', (message) => {
      const error = new ConnectionError(`WhatsApp auth failure: ${message}`)
      logger.error('WhatsApp auth failure', { userId: this.userId, orgId: this.orgId, error: error.message })
    })
  }

  private async handleOutgoing(msg: Message): Promise<void> {
    if (!msg.fromMe) return
    if (!this.isSelfChat(msg)) return
    if (!msg.body.trim()) return

    /**
     * Dedup por cuerpo: si este cuerpo coincide con una respuesta reciente del bot
     * (aún dentro del TTL), es el eco de nuestro propio sendMessage() llegando
     * como evento message_create. Lo descartamos.
     *
     * No usamos msg.id.id porque en Android multi-device el ID que devuelve
     * sendMessage() es distinto al que llega en el evento posterior — confirmado
     * en producción. El cuerpo es la única propiedad garantizada idéntica.
     */
    const bodyExpiry = this.sentBodies.get(msg.body)
    if (bodyExpiry !== undefined && Date.now() < bodyExpiry) {
      logger.debug('Ignoring bot echo (body dedup)', {
        userId: this.userId,
        orgId: this.orgId,
        bodyPrefix: msg.body.slice(0, 40),
      })
      return
    }

    const rawId = msg.id.id
    const message = {
      id: rawId,
      body: msg.body,
      timestamp: msg.timestamp,
      chatId: msg.from,
      fromMe: msg.fromMe,
    }

    try {
      const answer = await this.processMessage.execute(message)
      if (answer && this.selfChatId) {
        /**
         * CRITICAL: register body BEFORE calling sendMessage().
         *
         * In whatsapp-web.js, the message_create event for the sent message
         * can arrive WHILE sendMessage() is awaiting (i.e., before the
         * Promise resolves). If we register after, handleOutgoing will have
         * already processed the bot's own response — infinite loop guaranteed.
         */
        this.sentBodies.set(answer, Date.now() + 60_000)
        this.purgeExpiredBodies()
        const sent = await this.client.sendMessage(this.selfChatId, answer)
        logger.debug('Reply sent', { userId: this.userId, orgId: this.orgId, incomingId: rawId, sentId: sent.id.id })
      }
    } catch (error) {
      if (error instanceof BackboneUnavailableError) {
        logger.error('Backbone unavailable while processing message', { userId: this.userId, orgId: this.orgId, error: error.message, rawId })
      } else {
        logger.error('Error processing message', { userId: this.userId, orgId: this.orgId, error, rawId })
      }
    }
  }

  /** Purge expired entries from sentBodies to avoid memory leak. */
  private purgeExpiredBodies(): void {
    const now = Date.now()
    for (const [body, exp] of this.sentBodies) {
      if (now > exp) this.sentBodies.delete(body)
    }
  }

  /**
   * A message belongs to the self-chat when the recipient is the user's own JID.
   * Normalizes the JID (only the numeric part before @) to absorb format
   * variations between iOS and Android multi-device.
   */
  private isSelfChat(msg: Message): boolean {
    if (this.selfChatId === null) return false
    const normalize = (jid: string) => jid.split('@')[0] ?? jid
    return normalize(msg.to) === normalize(this.selfChatId)
  }

  async start(): Promise<void> {
    logger.info('Starting WhatsApp client...', { userId: this.userId, orgId: this.orgId })
    try {
      await this.client.initialize()
    } catch (error) {
      throw new ConnectionError(
        `Failed to initialize WhatsApp client for user ${this.userId}`,
        error,
      )
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping WhatsApp client...', { userId: this.userId, orgId: this.orgId })
    try {
      await this.client.destroy()
    } catch (error) {
      throw new ConnectionError(
        `Failed to stop WhatsApp client for user ${this.userId}`,
        error,
      )
    }
  }
}
