import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-minimum-32-characters-ok'
  process.env.NODE_ENV = 'test'
})

describe('JWT auth', () => {
  it('createJWT + verifyJWT round-trip', async () => {
    const { createJWT, verifyJWT } = await import('../lib/auth')
    const payload = { id: 'u1', name: 'Test User', username: 'test', role: 'employee' as const }
    const token = await createJWT(payload)
    expect(typeof token).toBe('string')
    const verified = await verifyJWT(token)
    expect(verified.id).toBe('u1')
    expect(verified.role).toBe('employee')
  })

  it('verifyJWT rejects tampered token', async () => {
    const { createJWT, verifyJWT } = await import('../lib/auth')
    const token = await createJWT({ id: 'u1', name: 'T', username: 't', role: 'employee' })
    const tampered = token.slice(0, -5) + 'XXXXX'
    await expect(verifyJWT(tampered)).rejects.toThrow()
  })

  it('createPasswordResetToken has type=password_reset', async () => {
    const { createPasswordResetToken, verifyPasswordResetToken } = await import('../lib/auth')
    const token = await createPasswordResetToken('user-123', 'somehash')
    const { sub, pwh } = await verifyPasswordResetToken(token)
    expect(sub).toBe('user-123')
    expect(pwh).toBe('somehash')
  })

  it('wrong type token is rejected by verifyPasswordResetToken', async () => {
    const { createJWT, verifyPasswordResetToken } = await import('../lib/auth')
    const token = await createJWT({ id: 'u1', name: 'T', username: 't', role: 'employee' })
    await expect(verifyPasswordResetToken(token)).rejects.toThrow('Invalid token')
  })
})
