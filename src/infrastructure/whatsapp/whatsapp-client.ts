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
     * message_create: se dispara para TODOS los mensajes que el usuario escribe,
     * en cualquier chat (incluyendo sync de dispositivos vinculados).
     * Filtramos solo el self-chat y excluimos las respuestas del propio bot.
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
      logger.debug('Ignorando respuesta propia del bot (body dedup)', {
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
        const sent = await this.client.sendMessage(this.selfChatId, answer)
        // Registrar el cuerpo enviado con TTL de 60 s.
        // Nunca borramos en el match — expiramos por timestamp.
        this.sentBodies.set(answer, Date.now() + 60_000)
        this.purgeExpiredBodies()
        logger.debug('Respuesta enviada', { incomingId: rawId, sentId: sent.id.id })
      }
    } catch (error) {
      logger.error('Error procesando mensaje', { error, rawId })
    }
  }

  /** Elimina entradas expiradas del mapa sentBodies para evitar memory leak. */
  private purgeExpiredBodies(): void {
    const now = Date.now()
    for (const [body, exp] of this.sentBodies) {
      if (now > exp) this.sentBodies.delete(body)
    }
  }

  /**
   * Un mensaje pertenece al self-chat cuando el destinatario es el propio JID.
   * Normaliza el JID (solo la parte numérica antes de @) para absorber variaciones
   * de formato entre iOS y Android multi-device.
   */
  private isSelfChat(msg: Message): boolean {
    if (this.selfChatId === null) return false
    const normalize = (jid: string) => jid.split('@')[0] ?? jid
    return normalize(msg.to) === normalize(this.selfChatId)
  }

  async start(): Promise<void> {
    logger.info('Iniciando WhatsApp client...')
    await this.client.initialize()
  }

  async stop(): Promise<void> {
    logger.info('Deteniendo WhatsApp client...')
    await this.client.destroy()
  }

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
