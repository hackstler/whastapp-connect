import type { HonoRequest } from 'hono'

const AUTH_COOKIE_NAME = 'auth_token'

function parseCookieHeader(rawCookie: string): Record<string, string> {
  return rawCookie
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, item) => {
      const idx = item.indexOf('=')
      if (idx <= 0) return acc
      const key = item.slice(0, idx).trim()
      const value = item.slice(idx + 1).trim()
      if (!key) return acc
      acc[key] = decodeURIComponent(value)
      return acc
    }, {})
}

export function getJwtFromRequest(req: HonoRequest): string | null {
  const authHeader = req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    return token || null
  }

  const cookieHeader = req.header('Cookie')
  if (!cookieHeader) return null

  const cookies = parseCookieHeader(cookieHeader)
  return cookies[AUTH_COOKIE_NAME] ?? null
}

export function authCookie(token: string, maxAgeSeconds: number): string {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
}

export function clearAuthCookie(): string {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
