export type Role = 'admin' | 'user'

export interface JwtPayload {
  readonly userId: string
  readonly username: string
  readonly orgId: string
  readonly role: Role
  readonly exp: number
  readonly iat: number
}
