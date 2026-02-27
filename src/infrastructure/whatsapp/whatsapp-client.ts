import { Client, LocalAuth } from 'whatsapp-web.js'
import type { Message } from 'whatsapp-web.js'

import type { ProcessMessageUseCase } from '../../application/use-cases/process-message.use-case'
import type { DedupPort } from '../../domain/ports/dedup.port'
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

  constructor(
    sessionPath: string,
    private readonly processMessage: ProcessMessageUseCase,
    /**
     * Cache de dedup para respuestas enviadas por el bot.
     * Usa msg.id.id (ID crudo sin prefijos fromMe/remote) para ser consistente
     * entre iOS y Android multi-device, donde _serialized puede diferir.
     * El TTL lo gestiona LruDedupCache internamente — sin setTimeout manual.
     */
    private readonly replyDedup: DedupPort,
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
     * Usamos msg.id.id (ID crudo) en lugar de msg.id._serialized.
     * _serialized incluye prefijos "fromMe_remote_" que en Android multi-device
     * pueden diferir entre lo que devuelve sendMessage() y lo que llega en el evento,
     * rompiendo el dedup. El ID crudo es estable en todos los dispositivos.
     */
    const rawId = msg.id.id

    if (this.replyDedup.isDuplicate(rawId)) {
      logger.debug('Ignorando mensaje propio del bot (dedup)', { rawId })
      return
    }

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
        this.replyDedup.markSeen(sent.id.id)
        logger.debug('Respuesta enviada', { incomingId: rawId, sentId: sent.id.id })
      }
    } catch (error) {
      logger.error('Error procesando mensaje', { error, rawId })
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
