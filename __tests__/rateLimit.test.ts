import { describe, it, expect, beforeEach } from 'vitest'

// Force in-memory fallback by ensuring no KV env vars
beforeEach(() => {
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
})

describe('rateLimit (in-memory)', () => {
  it('allows requests under the limit', async () => {
    const { rateLimit } = await import('../lib/rateLimit')
    const key = `test-allow-${Date.now()}`
    expect(await rateLimit(key, 3, 60_000)).toBe(true)
    expect(await rateLimit(key, 3, 60_000)).toBe(true)
    expect(await rateLimit(key, 3, 60_000)).toBe(true)
  })

  it('blocks when limit is exceeded', async () => {
    const { rateLimit } = await import('../lib/rateLimit')
    const key = `test-block-${Date.now()}`
    await rateLimit(key, 2, 60_000)
    await rateLimit(key, 2, 60_000)
    expect(await rateLimit(key, 2, 60_000)).toBe(false)
  })

  it('different keys are independent', async () => {
    const { rateLimit } = await import('../lib/rateLimit')
    const ts = Date.now()
    await rateLimit(`key-a-${ts}`, 1, 60_000)
    expect(await rateLimit(`key-b-${ts}`, 1, 60_000)).toBe(true)
  })
})
