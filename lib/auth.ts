import { SignJWT, jwtVerify } from 'jose'
import type { JWTUser } from './types'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
)

export async function createJWT(payload: JWTUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret)
}

export async function verifyJWT(token: string): Promise<JWTUser> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as JWTUser
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: 'password_reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
}

export async function verifyPasswordResetToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret)
  if (payload.type !== 'password_reset' || !payload.sub) throw new Error('Invalid token')
  return payload.sub
}

