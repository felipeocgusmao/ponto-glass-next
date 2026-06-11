import { SignJWT, jwtVerify } from 'jose'
import type { JWTUser } from './types'

// Resolve the signing secret lazily so a missing JWT_SECRET fails at first use (fail-closed)
// rather than at module load — a module-load throw would break `next build`, which runs with
// NODE_ENV=production but without the runtime env vars present.
let _secret: Uint8Array | null = null
function getSecret(): Uint8Array {
  if (_secret) return _secret
  const s = process.env.JWT_SECRET
  if (s) { _secret = new TextEncoder().encode(s); return _secret }
  // No secret configured: tolerate a fixed dev secret ONLY in local development. Anywhere
  // else (production, Vercel preview deploys, CI/tests) fail closed instead of signing and
  // accepting tokens with a publicly-known constant, which would allow token forgery.
  if (process.env.NODE_ENV !== 'development')
    throw new Error('JWT_SECRET must be set')
  _secret = new TextEncoder().encode('dev-secret-change-in-production')
  return _secret
}

export async function createJWT(payload: JWTUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret())
}

export async function verifyJWT(token: string): Promise<JWTUser> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as unknown as JWTUser
}

// Like verifyJWT but also returns the token's issued-at (seconds). Used by the API auth
// layer to enforce session revocation (sessions_valid_from). Kept separate from verifyJWT
// so the edge middleware keeps using the lightweight, DB-free verify.
export async function verifyJWTWithMeta(token: string): Promise<{ user: JWTUser; iat: number }> {
  const { payload } = await jwtVerify(token, getSecret())
  return { user: payload as unknown as JWTUser, iat: (payload.iat as number) ?? 0 }
}

// `fingerprint` ties the token to the user's current password hash, making it single-use:
// once the password changes (reset, self-change, or admin recovery) the fingerprint no
// longer matches, so the link cannot be replayed within its remaining 1h window.
export async function createPasswordResetToken(userId: string, fingerprint?: string): Promise<string> {
  const claims: Record<string, unknown> = { sub: userId, type: 'password_reset' }
  if (fingerprint) claims.pwh = fingerprint
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getSecret())
}

// Issued after a correct password when the account has TOTP enabled: proves
// "first factor done" for the 5-minute window the user has to type the code.
// It is NOT a session — it cannot be used against any API route.
export async function createTotpPendingToken(userId: string, tenantId: string): Promise<string> {
  return new SignJWT({ sub: userId, tid: tenantId, type: 'totp_pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(getSecret())
}

export async function verifyTotpPendingToken(token: string): Promise<{ sub: string; tid: string }> {
  const { payload } = await jwtVerify(token, getSecret())
  if (payload.type !== 'totp_pending' || !payload.sub || !payload.tid) throw new Error('Invalid token')
  return { sub: payload.sub as string, tid: payload.tid as string }
}

export async function verifyPasswordResetToken(token: string): Promise<{ sub: string; pwh?: string }> {
  const { payload } = await jwtVerify(token, getSecret())
  if (payload.type !== 'password_reset' || !payload.sub) throw new Error('Invalid token')
  return { sub: payload.sub as string, pwh: payload.pwh as string | undefined }
}

