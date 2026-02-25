import jwt, { TokenExpiredError } from 'jsonwebtoken'

import { AppError } from '../../shared/errors/app.error'
import type { JwtPayload } from './user.types'

export class JwtAuthError extends AppError {
  readonly code = 'JWT_INVALID'
}

export class JwtExpiredError extends AppError {
  readonly code = 'JWT_EXPIRED'
}

const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 días

export class JwtService {
  constructor(private readonly secret: string) {}

  sign(payload: Omit<JwtPayload, 'exp' | 'iat'>): string {
    return jwt.sign(payload as object, this.secret, { expiresIn: TOKEN_EXPIRY_SECONDS })
  }

  verify(token: string): JwtPayload {
    let decoded: unknown
    try {
      decoded = jwt.verify(token, this.secret)
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new JwtExpiredError('Token expired', err)
      }
      throw new JwtAuthError('Invalid token', err)
    }
    if (!isJwtPayload(decoded)) {
      throw new JwtAuthError('Malformed token payload')
    }
    return decoded
  }
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['userId'] === 'string' &&
    typeof v['username'] === 'string' &&
    typeof v['orgId'] === 'string' &&
    (v['role'] === 'admin' || v['role'] === 'user') &&
    typeof v['exp'] === 'number' &&
    typeof v['iat'] === 'number'
  )
}
