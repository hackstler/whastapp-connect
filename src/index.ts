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

  // Auth client compartido: usa Bearer JWT si hay RAG_USERNAME+RAG_PASSWORD, X-API-Key como fallback
  const ragAuth = new RagAuthClient(
    config.INGEST_URL,
    config.RAG_USERNAME,
    config.RAG_PASSWORD,
    config.RAG_API_KEY,
  )

  const dedup = new LruDedupCache(config.DEDUP_MAX_SIZE, config.DEDUP_TTL_MS)
  const ingestAdapter = new RagIngestAdapter(config.INGEST_URL, ragAuth)
  const processMessage = new ProcessMessageUseCase(ingestAdapter, dedup)
  const whatsappClient = new WhatsAppListenerClient(config.SESSION_PATH, processMessage)

  createServer(config.PORT, whatsappClient, {
    apiKey: config.API_KEY,
    jwtSecret: config.JWT_SECRET,
    adminUsername: config.ADMIN_USERNAME,
    adminPassword: config.ADMIN_PASSWORD,
    ragIngestUrl: config.RAG_INGEST_URL,
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
