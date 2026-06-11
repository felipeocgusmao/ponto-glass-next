import { describe, it, expect } from 'vitest'
import { generateSync } from 'otplib'
import { generateTotpSecret, totpKeyUri, verifyTotpCode } from '../lib/totp'

const nowSec = () => Math.floor(Date.now() / 1000)

describe('totp', () => {
  it('verifies a code generated from the same secret', () => {
    const secret = generateTotpSecret()
    const code = generateSync({ secret })
    expect(verifyTotpCode(code, secret)).toBe(true)
  })

  it('tolerates whitespace in the typed code', () => {
    const secret = generateTotpSecret()
    const code = generateSync({ secret })
    expect(verifyTotpCode(` ${code.slice(0, 3)} ${code.slice(3)} `, secret)).toBe(true)
  })

  it('accepts the previous 30s step (clock drift) but not older codes', () => {
    const secret = generateTotpSecret()
    const prev = generateSync({ secret, epoch: nowSec() - 30 })
    const stale = generateSync({ secret, epoch: nowSec() - 120 })
    expect(verifyTotpCode(prev, secret)).toBe(true)
    expect(verifyTotpCode(stale, secret)).toBe(false)
  })

  it('rejects wrong, malformed and non-string codes', () => {
    const secret = generateTotpSecret()
    const code = generateSync({ secret })
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
    expect(verifyTotpCode(wrong, secret)).toBe(false)
    expect(verifyTotpCode('12345', secret)).toBe(false)   // 5 digits
    expect(verifyTotpCode('abcdef', secret)).toBe(false)
    expect(verifyTotpCode(123456, secret)).toBe(false)    // number, not string
    expect(verifyTotpCode(null, secret)).toBe(false)
  })

  it('rejects a code from a different secret', () => {
    const code = generateSync({ secret: generateTotpSecret() })
    let other = generateTotpSecret()
    // Regenerate on the 1-in-a-million collision.
    while (generateSync({ secret: other }) === code) other = generateTotpSecret()
    expect(verifyTotpCode(code, other)).toBe(false)
  })

  it('builds an otpauth URI with issuer and account', () => {
    const uri = totpKeyUri('maria.silva', 'JBSWY3DPEHPK3PXP')
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain('maria.silva')
    expect(uri).toContain('issuer=PontoGlass')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
  })
})
