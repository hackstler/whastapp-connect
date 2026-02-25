import { logger } from '../../shared/logger'

/**
 * Gestiona la autenticación JWT contra el backend RAG.
 * Login lazy en la primera petición; re-login automático en 401.
 *
 * Si se provee apiKey usa X-API-Key (fallback legacy).
 * Si se proveen username + password usa Bearer JWT.
 * Si no hay nada, no añade cabecera de auth (modo dev).
 */
export class RagAuthClient {
  private token: string | null = null
  private readonly authUrl: string

  constructor(
    baseUrl: string,
    private readonly username?: string,
    private readonly password?: string,
    private readonly apiKey?: string,
  ) {
    this.authUrl = new URL('/auth/login', baseUrl).href
  }

  async getHeaders(): Promise<Record<string, string>> {
    if (this.apiKey) {
      return { 'X-API-Key': this.apiKey }
    }
    if (!this.username || !this.password) {
      return {}
    }
    if (!this.token) {
      await this.login()
    }
    return { 'Authorization': `Bearer ${this.token}` }
  }

  /** Fuerza un nuevo login (llamar cuando el backend devuelve 401). */
  async relogin(): Promise<void> {
    this.token = null
    await this.login()
  }

  private async login(): Promise<void> {
    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    })
    if (!res.ok) {
      throw new Error(`RAG auth failed (${res.status}) — check RAG_USERNAME/RAG_PASSWORD`)
    }
    const data = await res.json() as { token: string }
    this.token = data.token
    logger.info('[rag-auth] Authenticated with RAG backend')
  }
}
