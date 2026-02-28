import { ProcessMessageUseCase } from './application/use-cases/process-message.use-case'
import { LruDedupCache } from './infrastructure/cache/lru-dedup.cache'
import { BackboneClient } from './infrastructure/http/backbone.client'
import { WhatsAppListenerClient } from './infrastructure/whatsapp/whatsapp-client'
import { config } from './shared/config'
import { logger } from './shared/logger'

async function main(): Promise<void> {
  // Composition root — manual DI

  const backbone = new BackboneClient(config.BACKBONE_URL, config.ORG_ID, config.JWT_SECRET)

  // Dedup for incoming messages (prevent processing the same message twice)
  const incomingDedup = new LruDedupCache(config.DEDUP_MAX_SIZE, config.DEDUP_TTL_MS)

  const processMessage = new ProcessMessageUseCase(backbone, incomingDedup)

  // Bot response dedup is handled internally in WhatsAppListenerClient
  // via Map<body, expiresAt> — can't rely on IDs because on Android multi-device
  // sendMessage() ID ≠ message_create event ID for the same message.
  const whatsappClient = new WhatsAppListenerClient(config.SESSION_PATH, processMessage, backbone)

  await whatsappClient.start()

  // Heartbeat: re-report current status every 30s so the backbone
  // recovers state after restarts or DB resets.
  const heartbeat = setInterval(() => {
    if (whatsappClient.isReady) {
      void backbone.reportStatus('connected')
    } else if (whatsappClient.currentQr) {
      void backbone.reportQr(whatsappClient.currentQr)
    }
  }, 30_000)

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — graceful shutdown`)
    clearInterval(heartbeat)
    await whatsappClient.stop()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((error: unknown) => {
  logger.error('Fatal error in main', { error })
  process.exit(1)
})
