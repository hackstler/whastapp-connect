import { SessionManager } from './infrastructure/session/session-manager'
import { config } from './shared/config'
import { logger } from './shared/logger'

async function main(): Promise<void> {
  const manager = new SessionManager(config)
  await manager.start()

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — graceful shutdown`)
    await manager.stop()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((error: unknown) => {
  logger.error('Fatal error in main', { error })
  process.exit(1)
})
