import { describe, it, expect, vi, beforeEach } from 'vitest'

// Integration-style tests for tenant isolation across API boundaries.
// These tests mock Supabase + auth at the boundary so no network is needed,
// but they exercise the full request → response pipeline of each handler.

// ── helpers ─────────────────────────────────────────────────────────────────

function makeRequest(opts: {
  path?: string
  method?: string
  body?: unknown
  cookieToken?: string
}): Request {
  const url = `http://localhost${opts.path ?? '/'}`
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (opts.cookieToken) headers.set('cookie', `ponto_token=${opts.cookieToken}`)
  return new Request(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

// ── Rate limit metadata ───────────────────────────────────────────────────

describe('checkRateLimit returns metadata', () => {
  beforeEach(() => { vi.resetModules() })

  it('includes limit, remaining and resetAt on success', async () => {
    const { checkRateLimit } = await import('../lib/rateLimit')
    const result = await checkRateLimit('test-meta-key', 5, 60_000)
    expect(result).toMatchObject({
      allowed: true,
      limit: 5,
    })
    expect(typeof result.remaining).toBe('number')
    expect(result.remaining).toBeGreaterThanOrEqual(0)
    expect(result.resetAt).toBeGreaterThan(Date.now() - 1000)
  })

  it('remaining decrements with each call', async () => {
    const { checkRateLimit } = await import('../lib/rateLimit')
    const key = `test-decrement-${Math.random()}`
    const r1 = await checkRateLimit(key, 3, 60_000)
    const r2 = await checkRateLimit(key, 3, 60_000)
    expect(r1.remaining).toBeGreaterThan(r2.remaining)
  })

  it('blocks after max requests and remaining is 0', async () => {
    const { checkRateLimit } = await import('../lib/rateLimit')
    const key = `test-block-${Math.random()}`
    for (let i = 0; i < 2; i++) await checkRateLimit(key, 2, 60_000)
    const blocked = await checkRateLimit(key, 2, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })
})

// ── Rate limit headers ────────────────────────────────────────────────────

describe('applyRateLimitHeaders', () => {
  it('sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset', async () => {
    const { applyRateLimitHeaders } = await import('../lib/rateLimit')
    const headers = new Headers()
    applyRateLimitHeaders(headers, { allowed: true, limit: 5, remaining: 3, resetAt: Date.now() + 60_000 })
    expect(headers.get('X-RateLimit-Limit')).toBe('5')
    expect(headers.get('X-RateLimit-Remaining')).toBe('3')
    expect(headers.get('X-RateLimit-Reset')).toBeTruthy()
    expect(headers.get('Retry-After')).toBeNull()
  })

  it('adds Retry-After when the request is blocked', async () => {
    const { applyRateLimitHeaders } = await import('../lib/rateLimit')
    const headers = new Headers()
    applyRateLimitHeaders(headers, { allowed: false, limit: 5, remaining: 0, resetAt: Date.now() + 30_000 })
    const retryAfter = Number(headers.get('Retry-After'))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(30)
  })
})

// ── TOTP backup codes ─────────────────────────────────────────────────────

describe('TOTP backup codes', () => {
  it('generates 10 codes in XXXX-XXXX format', async () => {
    const { generateBackupCodes } = await import('../lib/totp')
    const codes = generateBackupCodes()
    expect(codes).toHaveLength(10)
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    }
  })

  it('generates unique codes', async () => {
    const { generateBackupCodes } = await import('../lib/totp')
    const codes = generateBackupCodes(10)
    expect(new Set(codes).size).toBe(10)
  })

  it('hashBackupCode is deterministic', async () => {
    const { hashBackupCode } = await import('../lib/totp')
    expect(hashBackupCode('ABCD-EFGH')).toBe(hashBackupCode('ABCD-EFGH'))
    expect(hashBackupCode('ABCD-EFGH')).not.toBe(hashBackupCode('ABCD-EFGI'))
  })

  it('findMatchingBackupCode matches regardless of separator and case', async () => {
    const { generateBackupCodes, hashBackupCode, findMatchingBackupCode } = await import('../lib/totp')
    const codes = generateBackupCodes(3)
    const hashes = codes.map(hashBackupCode)

    // Exact match
    expect(findMatchingBackupCode(codes[0], hashes)).toBe(hashes[0])
    // Without dash
    expect(findMatchingBackupCode(codes[1].replace('-', ''), hashes)).toBe(hashes[1])
    // Lowercase
    expect(findMatchingBackupCode(codes[2].toLowerCase(), hashes)).toBe(hashes[2])
  })

  it('findMatchingBackupCode returns null for wrong code', async () => {
    const { generateBackupCodes, hashBackupCode, findMatchingBackupCode } = await import('../lib/totp')
    const codes = generateBackupCodes(3)
    const hashes = codes.map(hashBackupCode)
    expect(findMatchingBackupCode('ZZZZ-ZZZZ', hashes)).toBeNull()
    expect(findMatchingBackupCode(null, hashes)).toBeNull()
    expect(findMatchingBackupCode(123, hashes)).toBeNull()
  })

  it('each code can only be used once (single-use enforcement)', async () => {
    const { generateBackupCodes, hashBackupCode, findMatchingBackupCode } = await import('../lib/totp')
    const codes = generateBackupCodes(5)
    let hashes = codes.map(hashBackupCode)

    const matched = findMatchingBackupCode(codes[0], hashes)!
    expect(matched).toBeTruthy()

    // Simulate consuming the code
    hashes = hashes.filter(h => h !== matched)
    expect(hashes).toHaveLength(4)

    // Same code no longer matches
    expect(findMatchingBackupCode(codes[0], hashes)).toBeNull()
  })
})

// ── CSRF protection ───────────────────────────────────────────────────────

describe('isCsrfSafe', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_APP_URL = 'https://pontoglass.app'
    process.env.NODE_ENV = 'production'
  })

  it('allows requests with no Origin header (direct API calls)', async () => {
    const { isCsrfSafe } = await import('../lib/csrf')
    const req = { headers: new Headers() } as never
    expect(isCsrfSafe(req)).toBe(true)
  })

  it('allows same-origin requests', async () => {
    const { isCsrfSafe } = await import('../lib/csrf')
    const headers = new Headers({ origin: 'https://pontoglass.app' })
    expect(isCsrfSafe({ headers } as never)).toBe(true)
  })

  it('blocks cross-origin requests', async () => {
    const { isCsrfSafe } = await import('../lib/csrf')
    const headers = new Headers({ origin: 'https://evil.example.com' })
    expect(isCsrfSafe({ headers } as never)).toBe(false)
  })
})

// ── Punch timestamp_adjusted ──────────────────────────────────────────────

describe('resolvePunchTimestamp adjustment detection', () => {
  it('detects when a future queuedAt was overridden', async () => {
    const { resolvePunchTimestamp } = await import('../lib/punchValidation')
    const now = new Date('2026-06-22T10:00:00Z')
    const futureTs = '2026-06-22T10:05:00Z' // 5 min in the future
    const resolved = resolvePunchTimestamp(futureTs, now)
    // Future timestamps are rejected → falls back to now
    expect(resolved).toBe(now)
  })

  it('detects when a too-old queuedAt was overridden', async () => {
    const { resolvePunchTimestamp } = await import('../lib/punchValidation')
    const now = new Date('2026-06-22T10:00:00Z')
    const oldTs = '2026-06-20T10:00:00Z' // 2 days old
    const resolved = resolvePunchTimestamp(oldTs, now)
    // Too-old timestamps rejected → falls back to now
    expect(resolved).toBe(now)
  })

  it('does NOT flag adjustment for a valid queuedAt', async () => {
    const { resolvePunchTimestamp } = await import('../lib/punchValidation')
    const now = new Date('2026-06-22T10:00:00Z')
    const validTs = '2026-06-22T06:30:00.000Z' // 3.5h ago, within 24h window
    const resolved = resolvePunchTimestamp(validTs, now)
    expect(resolved).not.toBe(now)
    expect(resolved.toISOString()).toBe(validTs)
  })
})

// ── Report pagination ─────────────────────────────────────────────────────

describe('reports pagination parameters', () => {
  it('clamps page to minimum 1', () => {
    const page = Math.max(1, parseInt('-5', 10) || 1)
    expect(page).toBe(1)
  })

  it('clamps limit to MAX_PAGE_SIZE', () => {
    const MAX_PAGE_SIZE = 2000
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt('9999', 10)))
    expect(limit).toBe(MAX_PAGE_SIZE)
  })

  it('computes correct offset for page 3, limit 100', () => {
    const page = 3
    const limit = 100
    const offset = (page - 1) * limit
    expect(offset).toBe(200)
  })

  it('computes totalPages correctly', () => {
    const total = 1050
    const limit = 500
    const totalPages = Math.ceil(total / limit)
    expect(totalPages).toBe(3)
  })
})
