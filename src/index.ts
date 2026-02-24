import { ProcessMessageUseCase } from './application/use-cases/process-message.use-case'
import { LruDedupCache } from './infrastructure/cache/lru-dedup.cache'
import { RagIngestAdapter } from './infrastructure/http/rag-ingest.adapter'
import { createServer } from './infrastructure/http/server'
import { WhatsAppListenerClient } from './infrastructure/whatsapp/whatsapp-client'
import { config } from './shared/config'
import { logger } from './shared/logger'

async function main(): Promise<void> {
  // Composition root — DI manual
  const dedup = new LruDedupCache(config.DEDUP_MAX_SIZE, config.DEDUP_TTL_MS)
  const ingestAdapter = new RagIngestAdapter(config.INGEST_URL)
  const processMessage = new ProcessMessageUseCase(ingestAdapter, dedup)
  const whatsappClient = new WhatsAppListenerClient(config.SESSION_PATH, processMessage)

  createServer(config.PORT, whatsappClient, config.API_KEY)
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
