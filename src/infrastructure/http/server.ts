import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { logger } from '../../shared/logger'

export function createHealthServer(port: number): void {
  const app = new Hono()

  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  serve({ fetch: app.fetch, port }, () => {
    logger.info('Health server listening', { port })
  })
}
