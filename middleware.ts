import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { isCsrfSafe } from '@/lib/csrf'

// '/demo' is deliberately public (fictitious evaluation credentials, noindex) —
// it was accidentally login-gated by the private-instance change; the CI E2E
// suite caught the regression (#253).
// '/api/kiosk/employees' + '/api/kiosk/punch' authenticate via the tenant's
// kiosk_token (not the session cookie) — the shared tablet is never logged in.
// '/api/kiosk/token' stays session-gated: it mints/reveals that token.
const PUBLIC = ['/login', '/reset-password', '/demo', '/api/auth/login', '/api/auth/logout', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/recover', '/api/auth/confirm-email', '/api/cron', '/api/health', '/api/qr/punch', '/api/kiosk/employees', '/api/kiosk/punch', '/kiosk/confirm']

// Force a fresh fetch of every HTML page on every navigation. Without this,
// iOS Safari (and other browsers) can serve a stale login or admin shell from
// the HTTP cache for hours after a deploy — exactly the failure mode reported
// when phase 4 of multi-tenancy went live. API routes set their own headers,
// _next/static/* assets are hash-versioned and immutable, so neither cares.
function withHtmlNoStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, must-revalidate')
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CSRF (defence-in-depth over the SameSite=Lax cookie): every API mutation
  // gets the Origin check, instead of relying on each route remembering to
  // call isCsrfSafe itself. Requests without an Origin header (curl, crons,
  // server-to-server) pass — they can't carry the httpOnly cookie cross-site.
  if (
    pathname.startsWith('/api/') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
    !isCsrfSafe(request)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Static / PWA assets must be reachable WITHOUT auth. Otherwise an
  // unauthenticated request (e.g. Safari fetching the apple-touch-icon from the
  // /login screen, or a browser reading the manifest to offer "Install") gets
  // redirected to /login and receives HTML instead of the asset — which shows
  // up as a blank "Add to Home Screen" icon and a broken PWA install.
  if (
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/robots.txt' ||
    pathname === '/opengraph-image' ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon')
  ) {
    return NextResponse.next()
  }

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    // Already logged in → skip login page
    if (pathname === '/login') {
      // A protected page bounced the user back with ?session=expired because the
      // token failed FULL validation (revoked session / inactive / unknown user)
      // even though its signature is still valid. verifyJWT below would pass and
      // redirect right back into that page → infinite redirect loop
      // (ERR_TOO_MANY_REDIRECTS). Clear the stale cookie and render the login form.
      if (request.nextUrl.searchParams.has('session')) {
        const res = withHtmlNoStore(NextResponse.next())
        res.cookies.delete('ponto_token')
        return res
      }
      const token = request.cookies.get('ponto_token')?.value
      if (token) {
        try {
          const user = await verifyJWT(token)
          return NextResponse.redirect(
            new URL(['admin', 'manager'].includes(user.role) ? '/admin' : '/ponto', request.url)
          )
        } catch {}
      }
    }
    // API routes manage their own cache headers; only force-fresh HTML routes.
    return pathname.startsWith('/api/') ? NextResponse.next() : withHtmlNoStore(NextResponse.next())
  }

  // The shared-tablet kiosk link (/kiosk?token=<kiosk_token>) is public by
  // design — the admin hands it to a device that is never logged in. The page
  // validates the token against tenants.kiosk_token and refuses invalid ones.
  // Without the param, /kiosk keeps requiring an admin/manager session.
  if (pathname === '/kiosk' && request.nextUrl.searchParams.has('token')) {
    return withHtmlNoStore(NextResponse.next())
  }

  const token = request.cookies.get('ponto_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  let user
  try {
    user = await verifyJWT(token)
  } catch {
    const res = NextResponse.redirect(new URL('/login', request.url))
    res.cookies.delete('ponto_token')
    return res
  }

  const isPrivilegedRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/employees') ||
    pathname.startsWith('/api/reports')

  if (isPrivilegedRoute && !['admin', 'manager'].includes(user.role)) {
    return NextResponse.redirect(new URL('/ponto', request.url))
  }

  if (pathname.startsWith('/ponto') && ['admin', 'manager'].includes(user.role)) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return pathname.startsWith('/api/') ? NextResponse.next() : withHtmlNoStore(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
