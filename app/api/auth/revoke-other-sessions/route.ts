import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { createJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { isCsrfSafe } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  // Move sessions_valid_from to now — all tokens with iat < now are revoked.
  // The new token issued below has iat >= now, so it passes the check.
  await supabase
    .from('employees')
    .update({ sessions_valid_from: new Date().toISOString() })
    .eq('id', user.id)

  const newToken = await createJWT({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    tenant_id: user.tenant_id,
  })

  const res = NextResponse.json({ success: true })
  res.cookies.set('ponto_token', newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return res
}
