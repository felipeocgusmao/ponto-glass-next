import { createHmac, timingSafeEqual } from 'crypto'

// Shared between /api/qr (token generation) and /api/qr/punch (verification)
// so the two can never drift apart.

// Resolve the HMAC secret with the same fail-closed policy as lib/auth: a
// publicly-known fallback is tolerated ONLY in local development. Anywhere
// else a missing secret must throw instead of silently signing predictable
// tokens that anyone could forge.
function getQrSecret(): string {
  const secret = process.env.QR_SECRET ?? process.env.JWT_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV !== 'development')
    throw new Error('QR_SECRET or JWT_SECRET must be set')
  return 'qr-fallback'
}

export function qrToken(employeeId: string, tenantId: string): string {
  return createHmac('sha256', getQrSecret())
    .update(`${employeeId}:${tenantId}`)
    .digest('base64url')
    .slice(0, 32)
}

/** Constant-time comparison of a client-supplied token against the expected
 *  HMAC, so response timing can't leak how many leading characters matched. */
export function verifyQrToken(token: string, employeeId: string, tenantId: string): boolean {
  const expected = Buffer.from(qrToken(employeeId, tenantId))
  const provided = Buffer.from(token)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}
