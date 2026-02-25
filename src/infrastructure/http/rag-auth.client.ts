import jwt from 'jsonwebtoken'

import { logger } from '../../shared/logger'

/**
 * Genera un JWT de servicio firmado con el JWT_SECRET compartido con el backbone.
 * El backbone lo acepta porque verifica con el mismo secret.
 * No requiere credenciales de usuario — el único secreto necesario es JWT_SECRET.
 */
export class RagAuthClient {
  private readonly token: string

  constructor(jwtSecret: string) {
    this.token = jwt.sign(
      { userId: 'whatsapp-rag', username: 'whatsapp-rag', orgId: 'system', role: 'admin' },
      jwtSecret,
      { expiresIn: '365d' },
    )
    logger.info('[rag-auth] Service JWT generado')
  }

  async getHeaders(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${this.token}` }
  }

  /** No-op: el token de servicio es de larga duración. Un 401 indica JWT_SECRET incorrecto. */
  async relogin(): Promise<void> {
    logger.error('[rag-auth] 401 recibido — verifica que JWT_SECRET coincide con el backbone')
  }
}
