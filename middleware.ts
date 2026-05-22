import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'

const PUBLIC = ['/login', '/reset-password', '/api/auth/login', '/api/auth/logout', '/api/auth/forgot-password', '/api/auth/reset-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

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
    return NextResponse.next()
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

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
