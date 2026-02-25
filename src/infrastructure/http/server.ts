import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import QRCode from 'qrcode'

import { type AppEnv, validateToken } from '../auth/auth.middleware'
import { JwtService } from '../auth/jwt.service'
import { authCookie, clearAuthCookie, getJwtFromRequest } from '../auth/token.utils'
import { logger } from '../../shared/logger'
import type { WhatsAppListenerClient } from '../whatsapp/whatsapp-client'
import type { RagAuthClient } from './rag-auth.client'
import { dashboardView } from './views/dashboard.view'
import { loginView } from './views/login.view'
import { qrView } from './views/qr.view'

export interface ServerOptions {
  /** Secret para verificar los JWT emitidos por el backbone RAG. Debe ser el mismo JWT_SECRET del backbone. */
  jwtSecret: string
  /** URL base del backbone RAG sin path ni slash final (p.ej. https://backbone.railway.app) */
  ragHost: string
  /** Cliente de auth compartido — firma JWT de servicio con JWT_SECRET */
  ragAuth: RagAuthClient
  /** Si está activo, /api/ingest/{url,file} responden mock */
  ragIngestMockEnabled?: boolean
  /** Latencia artificial para respuestas mock */
  ragIngestMockDelayMs?: number
}

export function createServer(
  port: number,
  whatsapp: WhatsAppListenerClient,
  opts: ServerOptions,
): void {
  const jwtService = new JwtService(opts.jwtSecret)

  const jwtMiddleware = validateToken(jwtService)

  const backboneLoginUrl = `${opts.ragHost}/auth/login`
  const backboneIngestUrl = `${opts.ragHost}/ingest`

  const app = new Hono<AppEnv>()

  // ── Public ────────────────────────────────────────────────
  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      whatsapp: whatsapp.isReady ? 'connected' : whatsapp.currentQr ? 'waiting_qr' : 'disconnected',
      timestamp: new Date().toISOString(),
    }),
  )

  app.get('/login', (c) => {
    const token = getJwtFromRequest(c.req)
    if (token) {
      try {
        jwtService.verify(token)
        return c.redirect('/dashboard')
      } catch {
        // token inválido/expirado: renderiza login normal
      }
    }
    return c.html(loginView())
  })

  // ── Auth ──────────────────────────────────────────────────
  /**
   * Proxy al endpoint /auth/login del backbone RAG.
   * El backbone valida las credenciales y devuelve su JWT (firmado con JWT_SECRET compartido).
   * Ese token se usa directamente como sesión del dashboard.
   */
  app.post('/auth/login', async (c) => {
    let username: unknown
    let password: unknown
    try {
      const body = await c.req.json<{ username: unknown; password: unknown }>()
      username = body.username
      password = body.password
    } catch {
      return c.json({ error: 'Cuerpo JSON inválido' }, 400)
    }

    if (typeof username !== 'string' || !username.trim()) {
      return c.json({ error: 'username es requerido' }, 400)
    }
    if (typeof password !== 'string' || !password) {
      return c.json({ error: 'password es requerido' }, 400)
    }

    let res: Response
    try {
      res = await fetch(backboneLoginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
    } catch (err) {
      logger.error('Error conectando al backbone RAG para login', { err })
      return c.json({ error: 'Error de conexión con el backend RAG' }, 502)
    }

    if (res.status === 401) {
      return c.json({ error: 'Credenciales incorrectas' }, 401)
    }

    if (!res.ok) {
      logger.warn('Backbone auth error', { status: res.status })
      return c.json({ error: 'Error en el backend RAG', backbone_status: res.status }, 502)
    }

    const data = await res.json() as { token: string }
    const token = data.token
    logger.info('Login exitoso via backbone', { username: username.trim() })
    c.header('Set-Cookie', authCookie(token, 7 * 24 * 60 * 60))
    return c.json({ token })
  })

  app.post('/auth/logout', (c) => {
    c.header('Set-Cookie', clearAuthCookie())
    return c.json({ ok: true })
  })

  // ── Dashboard ─────────────────────────────────────────────
  app.get('/dashboard', (c) => {
    const token = getJwtFromRequest(c.req)
    if (!token) return c.redirect('/login')
    try {
      jwtService.verify(token)
      return c.html(dashboardView())
    } catch {
      c.header('Set-Cookie', clearAuthCookie())
      return c.redirect('/login')
    }
  })

  // ── API — requiere Bearer JWT ─────────────────────────────
  app.get('/api/me', jwtMiddleware, (c) => {
    const user = c.get('user')
    return c.json({
      username: user.username,
      orgId: user.orgId,
      role: user.role,
    })
  })

  /**
   * Devuelve el estado actual de WhatsApp y, si hay QR pendiente, el data-URL
   * de la imagen para que el dashboard lo muestre sin recargar la página.
   */
  app.get('/api/qr', jwtMiddleware, async (c) => {
    if (whatsapp.isReady) {
      return c.json({ status: 'connected' })
    }
    if (!whatsapp.currentQr) {
      return c.json({ status: 'initializing' })
    }
    const qrDataUrl = await QRCode.toDataURL(whatsapp.currentQr, { width: 300, margin: 2 })
    return c.json({ status: 'waiting_qr', qrDataUrl })
  })

  /**
   * Recibe { urls: string[] } y envía cada URL al backbone RAG.
   * Devuelve un resultado por URL (puede ser parcialmente exitoso → ok: false + results).
   */
  app.post('/api/ingest/url', jwtMiddleware, async (c) => {
    let urls: unknown
    try {
      const body = await c.req.json<{ urls: unknown }>()
      urls = body.urls
    } catch {
      return c.json({ error: 'Cuerpo JSON inválido' }, 400)
    }

    if (!Array.isArray(urls) || urls.some((u) => typeof u !== 'string')) {
      return c.json({ error: 'urls debe ser un array de strings' }, 400)
    }

    const typedUrls = urls as string[]

    if (opts.ragIngestMockEnabled) {
      await sleep(opts.ragIngestMockDelayMs ?? 400)
      const now = new Date().toISOString()
      const results = typedUrls.map((url, idx) => {
        const shouldFail = /fail|error|invalid/i.test(url)
        if (shouldFail) {
          return {
            url,
            ok: false as const,
            error: 'Mock ingest error: URL marcada para fallo (fail|error|invalid).',
          }
        }
        return {
          url,
          ok: true as const,
          data: {
            source: 'mock',
            ingestId: `mock-url-${idx + 1}`,
            status: 'queued',
            chunks: Math.max(1, Math.ceil(url.length / 24)),
            receivedAt: now,
          },
        }
      })
      const allOk = results.every((r) => r.ok)
      return c.json({ ok: allOk, results, source: 'mock' })
    }

    const settled = await Promise.allSettled(
      typedUrls.map(async (url) => {
        const authHeaders = await opts.ragAuth.getHeaders()
        const headers = { 'Content-Type': 'application/json', ...authHeaders }

        let res = await fetch(`${backboneIngestUrl}/url`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ url }),
        })

        if (res.status === 401) {
          await opts.ragAuth.relogin()
          const retryHeaders = { 'Content-Type': 'application/json', ...await opts.ragAuth.getHeaders() }
          res = await fetch(`${backboneIngestUrl}/url`, { method: 'POST', headers: retryHeaders, body: JSON.stringify({ url }) })
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '')
          throw new Error(`Backbone devolvió ${res.status}${errText ? ': ' + errText : ''}`)
        }

        const data = await res.json().catch(() => ({})) as Record<string, unknown>
        return { url, ok: true as const, data }
      }),
    )

    const results = settled.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            url: typedUrls[i] ?? '',
            ok: false as const,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          },
    )

    const allOk = results.every((r) => r.ok)
    logger.info('URL ingest completado', {
      total: typedUrls.length,
      ok: results.filter((r) => r.ok).length,
    })
    return c.json({ ok: allOk, results })
  })

  /**
   * Recibe un fichero multipart y lo reenvía directamente al backbone RAG.
   */
  app.post('/api/ingest/file', jwtMiddleware, async (c) => {
    const contentType = c.req.header('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return c.json({ error: 'Content-Type debe ser multipart/form-data' }, 400)
    }

    if (opts.ragIngestMockEnabled) {
      let formData: FormData
      try {
        formData = await c.req.formData()
      } catch {
        return c.json({ error: 'No se pudo parsear multipart/form-data' }, 400)
      }

      const file = formData.get('file')
      if (!(file instanceof File)) {
        return c.json({ error: 'Campo file requerido' }, 400)
      }

      await sleep(opts.ragIngestMockDelayMs ?? 400)
      const approxChunks = Math.max(1, Math.ceil(file.size / 4096))
      return c.json({
        ok: true,
        source: 'mock',
        file: {
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
        },
        ingest: {
          ingestId: `mock-file-${Date.now()}`,
          status: 'processed',
          chunks: approxChunks,
          receivedAt: new Date().toISOString(),
        },
      })
    }

    // Leemos el cuerpo completo como buffer para evitar problemas de streaming
    let rawBody: ArrayBuffer
    try {
      rawBody = await c.req.raw.arrayBuffer()
    } catch {
      return c.json({ error: 'Error al leer el cuerpo de la petición' }, 400)
    }

    const authHeaders = await opts.ragAuth.getHeaders()
    const forwardHeaders: Record<string, string> = { 'content-type': contentType, ...authHeaders }

    let res: Response
    try {
      res = await fetch(`${backboneIngestUrl}/file`, { method: 'POST', headers: forwardHeaders, body: rawBody })

      if (res.status === 401) {
        await opts.ragAuth.relogin()
        const retryHeaders = { 'content-type': contentType, ...await opts.ragAuth.getHeaders() }
        res = await fetch(`${backboneIngestUrl}/file`, { method: 'POST', headers: retryHeaders, body: rawBody })
      }
    } catch (err) {
      logger.error('Error reenviando fichero al backbone', { err })
      return c.json({ error: 'Error de conexión con el backbone RAG' }, 502)
    }

    if (!res.ok) {
      logger.warn('Backbone file ingest error', { status: res.status })
      return c.json({ error: 'Error en el backbone RAG', backbone_status: res.status }, 502)
    }

    const data = await res.json().catch(() => ({ ok: true })) as Record<string, unknown>
    logger.info('File ingest completado')
    return c.json(data)
  })

  // ── Admin — requiere JWT o API key legacy ─────────────────
  app.get('/qr', jwtMiddleware, async (c) => {
    if (whatsapp.isReady) {
      return c.html(qrView({ status: 'connected' }))
    }

    const qr = whatsapp.currentQr
    if (!qr) {
      return c.html(qrView({ status: 'initializing', refreshSeconds: 3 }))
    }

    const dataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 })
    return c.html(qrView({ status: 'waiting_qr', qrDataUrl: dataUrl, refreshSeconds: 15 }))
  })

  app.post('/logout', jwtMiddleware, async (c) => {
    await whatsapp.logout()
    return c.json({ ok: true, message: 'Sesión cerrada. Reinicia el servicio para vincular de nuevo.' })
  })

  serve({ fetch: app.fetch, port }, () => {
    logger.info('Server listening', { port })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
