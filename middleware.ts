import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'

const PUBLIC = ['/login', '/reset-password', '/api/auth/login', '/api/auth/logout', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/recover', '/api/auth/confirm-email', '/api/cron', '/api/health', '/api/qr/punch', '/kiosk/confirm']

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
