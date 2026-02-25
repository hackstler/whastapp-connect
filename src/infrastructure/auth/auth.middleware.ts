import type { MiddlewareHandler } from 'hono'

import { logger } from '../../shared/logger'
import { JwtAuthError, JwtExpiredError, JwtService } from './jwt.service'
import { getJwtFromRequest } from './token.utils'
import type { JwtPayload } from './user.types'

export type AppEnv = { Variables: { user: JwtPayload } }

/**
 * Middleware que exige un Bearer JWT válido.
 * En caso de éxito, establece c.get('user') con el payload decodificado.
 */
export function validateToken(jwtService: JwtService): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getJwtFromRequest(c.req)
    if (!token) {
      return c.json({ error: 'Authorization required' }, 401)
    }
    try {
      const payload = jwtService.verify(token)
      c.set('user', payload)
      return next()
    } catch (err) {
      if (err instanceof JwtExpiredError) {
        return c.json({ error: 'Token expired' }, 401)
      }
      if (err instanceof JwtAuthError) {
        return c.json({ error: 'Invalid token' }, 401)
      }
      logger.error('Error inesperado en validateToken', { err })
      return c.json({ error: 'Internal server error' }, 500)
    }
  }
}
