import { generateSecret, generateURI, verifySync } from 'otplib'
import { createHash, randomBytes } from 'crypto'

// Thin wrapper around otplib (v13 functional API) so the rest of the codebase
// never touches the library directly — and the exact options we ship are
// unit-tested in one place.

export function generateTotpSecret(): string {
  return generateSecret()
}

/** otpauth:// URI for the QR code. Issuer + username is what the
 * authenticator app displays. */
export function totpKeyUri(username: string, secret: string): string {
  return generateURI({ secret, issuer: 'PontoGlass', label: username })
}

export function verifyTotpCode(code: unknown, secret: string): boolean {
  if (typeof code !== 'string') return false
  const token = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(token)) return false
  try {
    // epochTolerance is in SECONDS: 30 accepts the previous/next 30s step,
    // tolerating small clock drift between the phone and the server without
    // meaningfully weakening the factor.
    return verifySync({ token, secret, epochTolerance: 30 }).valid === true
  } catch { return false }
}

// ── Backup codes ────────────────────────────────────────────────────────────
// Single-use recovery codes for when the TOTP device is lost. Each code is
// 8 uppercase alphanumeric chars (without 0/O/I/l to avoid visual confusion),
// formatted as XXXX-XXXX. We store SHA-256 hashes (no bcrypt — they're long
// random strings, brute-forcing the hash space is infeasible).

const BACKUP_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8)
    const chars = Array.from(bytes, b => BACKUP_CHARS[b % BACKUP_CHARS.length]).join('')
    return `${chars.slice(0, 4)}-${chars.slice(4)}`
  })
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex')
}

/**
 * Check if a supplied code matches any stored hash and return the matched hash
 * so the caller can remove it (single-use). Returns null if no match.
 */
export function findMatchingBackupCode(code: unknown, hashes: string[]): string | null {
  if (typeof code !== 'string') return null
  const normalized = code.toUpperCase().replace(/[\s-]/g, '')
  if (!/^[A-Z0-9]{8}$/.test(normalized)) return null
  const incoming = hashBackupCode(normalized)
  return hashes.find(h => h === incoming) ?? null
}
