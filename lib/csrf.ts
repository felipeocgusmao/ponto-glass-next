import type { NextRequest } from 'next/server'

// CSRF protection via Origin/Referer header verification.
//
// Primary protection is already provided by `SameSite=Lax` on the session cookie
// (prevents cross-site POST requests from including the cookie). This adds an
// explicit Origin check as defence-in-depth on mutation endpoints.
//
// Rules:
// - Same-origin requests (Origin matches the app host) → allowed
// - Requests with no Origin header (e.g. server-to-server, curl) → allowed
//   (they can't carry the httpOnly session cookie anyway)
// - Cross-origin requests with a non-matching Origin → blocked with 403

function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const origins: string[] = []

  if (appUrl) {
    try {
      origins.push(new URL(appUrl).origin)
    } catch { /* ignore malformed URL */ }
  }

  // Always allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000')
    origins.push('http://127.0.0.1:3000')
  }

  return origins
}

/**
 * Returns true when the request is safe to process (same-origin or no Origin).
 * Returns false when the Origin header is present but doesn't match any allowed origin.
 */
export function isCsrfSafe(request: NextRequest): boolean {
  const origin = request.headers.get('origin')

  // No Origin header — direct API call (curl, server-to-server). Allowed because
  // a browser cross-origin request always includes an Origin header.
  if (!origin) return true

  // Same-origin against the actual request host. NEXT_PUBLIC_APP_URL can only
  // name ONE origin, but multi-tenancy serves the app from tenant subdomains
  // and custom domains too — those must not be rejected as "cross-origin".
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0].trim().toLowerCase()
  try {
    if (host && new URL(origin).host.toLowerCase() === host) return true
  } catch { /* malformed Origin → fall through to the allowlist */ }

  const allowed = getAllowedOrigins()

  // When no app URL is configured (e.g. local dev without env), skip CSRF check
  // to avoid locking out developers.
  if (allowed.length === 0) return true

  return allowed.some(o => o === origin)
}
