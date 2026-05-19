// In-memory rate limiter — resets on cold start (per-instance in serverless).
// For multi-instance production, replace the Map with an external store (Redis/Vercel KV).
const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= max) return false

  entry.count++
  return true
}
