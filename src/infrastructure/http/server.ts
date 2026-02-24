import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import QRCode from 'qrcode'

import type { WhatsAppListenerClient } from '../whatsapp/whatsapp-client'
import { logger } from '../../shared/logger'

function apiKeyMiddleware(apiKey: string | undefined): MiddlewareHandler {
  if (!apiKey) {
    return async (_c, next) => { await next() }
  }
  const key = apiKey
  return async (c, next) => {
    if (c.req.header('X-API-Key') !== key) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    return next()
  }
}

export function createServer(
  port: number,
  whatsapp: WhatsAppListenerClient,
  apiKey?: string,
): void {
  const app = new Hono()
  const auth = apiKeyMiddleware(apiKey)

  // ── Public ────────────────────────────────────────────────
  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      whatsapp: whatsapp.isReady ? 'connected' : whatsapp.currentQr ? 'waiting_qr' : 'disconnected',
      timestamp: new Date().toISOString(),
    }),
  )

  // ── Admin — requiere X-API-Key si API_KEY está configurada ─
  app.get('/qr', auth, async (c) => {
    if (whatsapp.isReady) {
      return c.html(page('✅ Conectado', '<p class="ok">WhatsApp ya está conectado. No hay QR que escanear.</p>'))
    }

    const qr = whatsapp.currentQr
    if (!qr) {
      return c.html(page('⏳ Iniciando…', '<p class="muted">El servicio aún está arrancando. La página se recarga sola.</p>', 3))
    }

    const dataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 })
    return c.html(
      page(
        '📱 Escanea el QR',
        `<img src="${dataUrl}" alt="WhatsApp QR" width="320" height="320">
         <p class="muted">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
         <p class="hint">Se recarga automáticamente cada 15 s</p>`,
        15,
      ),
    )
  })

  app.post('/logout', auth, async (c) => {
    await whatsapp.logout()
    return c.json({ ok: true, message: 'Sesión cerrada. Reinicia el servicio para vincular de nuevo.' })
  })

  serve({ fetch: app.fetch, port }, () => {
    logger.info('Server listening', { port })
  })
}

// ── Mini frontend helper ───────────────────────────────────
function page(title: string, body: string, refreshSecs?: number): string {
  const meta = refreshSecs ? `<meta http-equiv="refresh" content="${refreshSecs}">` : ''
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Emilio — ${title}</title>
  ${meta}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
    body {
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
      padding: 2rem;
    }
    h1 { font-size: 1.75rem; letter-spacing: -.02em }
    h2 { font-size: 1.1rem; opacity: .8 }
    img { border-radius: 12px; box-shadow: 0 0 48px rgba(99,102,241,.5) }
    .ok   { color: #4ade80; font-size: 1.1rem }
    .muted { opacity: .55; font-size: .9rem }
    .hint  { opacity: .4;  font-size: .75rem }
  </style>
</head>
<body>
  <h1>Emilio</h1>
  <h2>${title}</h2>
  ${body}
</body>
</html>`
}
