import type { NextRequest } from 'next/server'

// Rate limiter. When a shared KV store is configured (Vercel KV or Upstash Redis, via their
// REST API) the limit holds across all serverless instances and cold starts. Otherwise it
// falls back to a per-instance in-memory Map — better than nothing for single-instance/dev,
// but ineffective at scale (hence the KV path for production). See issue #65.

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

// Warn once at startup when running in production without distributed rate limiting.
// Multi-instance Vercel deployments share no memory, so per-instance limits offer
// minimal protection against coordinated brute-force attempts.
if (process.env.NODE_ENV === 'production' && (!KV_URL || !KV_TOKEN)) {
  console.warn(
    '[rateLimit] KV store not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing). ' +
    'Rate limiting is per-instance only — ineffective on multi-instance deployments. ' +
    'Set up Vercel KV or Upstash Redis for production-grade protection.'
  )
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number  // Unix ms (approximate for KV backend)
}

// ── In-memory fallback ──────────────────────────────────────────────────────────
const memStore = new Map<string, { count: number; resetAt: number }>()

function memRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, limit: max, remaining: max - 1, resetAt: now + windowMs }
  }
  if (entry.count >= max) {
    return { allowed: false, limit: max, remaining: 0, resetAt: entry.resetAt }
  }
  entry.count++
  return { allowed: true, limit: max, remaining: max - entry.count, resetAt: entry.resetAt }
}

// ── KV-backed (fixed window) ────────────────────────────────────────────────────
async function kvCommand(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(KV_URL!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`KV ${res.status}`)
  const data = await res.json() as { result?: unknown; error?: string }
  if (data.error) throw new Error(data.error)
  return data.result
}

async function kvRateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  const k = `rl:${key}`
  const now = Date.now()
  const count = await kvCommand(['INCR', k]) as number
  // Set the window TTL only on the first hit so the window is fixed, not sliding.
  if (count === 1) await kvCommand(['PEXPIRE', k, windowMs])
  const resetAt = now + windowMs  // approximate; exact TTL would need a PTTL round-trip
  const remaining = Math.max(0, max - count)
  return { allowed: count <= max, limit: max, remaining, resetAt }
}

/**
 * Returns the rate-limit result for `key`. `max` requests are permitted per
 * `windowMs`. Use `.allowed` for the allow/block decision; the other fields
 * drive the `X-RateLimit-*` response headers.
 */
export async function checkRateLimit(
  key: string,
  max = 5,
  windowMs = 15 * 60 * 1000,
): Promise<RateLimitResult> {
  if (KV_URL && KV_TOKEN) {
    try {
      return await kvRateLimit(key, max, windowMs)
    } catch {
      // KV unreachable → degrade to the in-memory limiter rather than locking everyone out.
      return memRateLimit(key, max, windowMs)
    }
  }
  return memRateLimit(key, max, windowMs)
}

/**
 * Convenience wrapper — returns true when the action is allowed, false when blocked.
 * Callers that need header metadata should use `checkRateLimit` directly.
 */
export async function rateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000): Promise<boolean> {
  return (await checkRateLimit(key, max, windowMs)).allowed
}

/**
 * Trusted client IP for rate-limit keys. Prefers NextRequest.ip (set by the Vercel platform
 * and not spoofable by the client); falls back to the left-most x-forwarded-for entry for
 * non-Vercel hosting.
 */
export function clientIp(request: NextRequest): string {
  return request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

/** Attach standard rate-limit headers to a Response or NextResponse headers object. */
export function applyRateLimitHeaders(headers: Headers, result: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', String(result.limit))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
    headers.set('Retry-After', String(retryAfter))
  }
}
