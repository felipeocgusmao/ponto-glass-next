import type { NextRequest } from 'next/server'

// Rate limiter. When a shared KV store is configured (Vercel KV or Upstash Redis, via their
// REST API) the limit holds across all serverless instances and cold starts. Otherwise it
// falls back to a per-instance in-memory Map — better than nothing for single-instance/dev,
// but ineffective at scale (hence the KV path for production). See issue #65.

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

// ── In-memory fallback ──────────────────────────────────────────────────────────
const memStore = new Map<string, { count: number; resetAt: number }>()

function memRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
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

async function kvRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const k = `rl:${key}`
  const count = await kvCommand(['INCR', k]) as number
  // Set the window TTL only on the first hit so the window is fixed, not sliding.
  if (count === 1) await kvCommand(['PEXPIRE', k, windowMs])
  return count <= max
}

/**
 * Returns true if the action is allowed (under the limit), false if it should be blocked.
 * `max` requests are permitted per `windowMs` for a given `key`.
 */
export async function rateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000): Promise<boolean> {
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
 * Trusted client IP for rate-limit keys. Prefers NextRequest.ip (set by the Vercel platform
 * and not spoofable by the client); falls back to the left-most x-forwarded-for entry for
 * non-Vercel hosting.
 */
export function clientIp(request: NextRequest): string {
  return request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
