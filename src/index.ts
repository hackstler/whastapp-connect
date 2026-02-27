import { ProcessMessageUseCase } from './application/use-cases/process-message.use-case'
import { LruDedupCache } from './infrastructure/cache/lru-dedup.cache'
import { RagAuthClient } from './infrastructure/http/rag-auth.client'
import { RagIngestAdapter } from './infrastructure/http/rag-ingest.adapter'
import { createServer } from './infrastructure/http/server'
import { WhatsAppListenerClient } from './infrastructure/whatsapp/whatsapp-client'
import { config } from './shared/config'
import { logger } from './shared/logger'

async function main(): Promise<void> {
  // Composition root — DI manual

  // Auth client compartido: firma un JWT de servicio con el JWT_SECRET compartido con el backbone
  const ragAuth = new RagAuthClient(config.JWT_SECRET)

  // Dedup de mensajes entrantes (evita procesar el mismo mensaje dos veces)
  const incomingDedup = new LruDedupCache(config.DEDUP_MAX_SIZE, config.DEDUP_TTL_MS)

  const ingestAdapter = new RagIngestAdapter(`${config.RAG_HOST}/chat`, ragAuth)
  const processMessage = new ProcessMessageUseCase(ingestAdapter, incomingDedup)
  // El dedup de respuestas propias del bot se maneja internamente en WhatsAppListenerClient
  // mediante un Map<body, expiresAt> — no depende de IDs porque en Android multi-device
  // el ID de sendMessage() ≠ ID en el evento message_create del mismo mensaje.
  const whatsappClient = new WhatsAppListenerClient(config.SESSION_PATH, processMessage)

  createServer(config.PORT, whatsappClient, {
    jwtSecret: config.JWT_SECRET,
    ragHost: config.RAG_HOST,
    ragAuth,
    ragIngestMockEnabled: config.RAG_INGEST_MOCK_ENABLED,
    ragIngestMockDelayMs: config.RAG_INGEST_MOCK_DELAY_MS,
  })

  await whatsappClient.start()

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} recibido — apagado graceful`)
    await whatsappClient.stop()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((error: unknown) => {
  logger.error('Error fatal en main', { error })
  process.exit(1)
})
