import { generateSecret, generateURI, verifySync } from 'otplib'

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
