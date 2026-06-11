import { NextRequest, NextResponse } from 'next/server'
import { createJWT, verifyTotpPendingToken } from '@/lib/auth'
import { verifyTotpCode } from '@/lib/totp'
import { supabase } from '@/lib/supabase'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'

// Second step of a TOTP login: pending token (from /api/auth/login) + 6-digit
// code → real session cookie. Same response shape as the password step so the
// login page redirect logic is shared.
export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  if (!(await rateLimit(`totp:${ip}`, 10, 15 * 60 * 1000)))
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' }, { status: 429 })

  const { pending, code } = await request.json()
  if (!pending || !code)
    return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })

  let claims: { sub: string; tid: string }
  try { claims = await verifyTotpPendingToken(String(pending)) }
  catch { return NextResponse.json({ error: 'Sessão de verificação expirada. Faça login novamente.' }, { status: 401 }) }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, username, role, tenant_id, totp_secret, totp_enabled, active')
    .eq('tenant_id', claims.tid)
    .eq('id', claims.sub)
    .eq('active', true)
    .single()

  if (!employee?.totp_enabled || !employee.totp_secret)
    return NextResponse.json({ error: 'Sessão de verificação inválida. Faça login novamente.' }, { status: 401 })

  if (!verifyTotpCode(code, employee.totp_secret))
    return NextResponse.json({ error: 'Código inválido. Confira o aplicativo autenticador.' }, { status: 401 })

  const token = await createJWT({
    id: employee.id,
    name: employee.name,
    username: employee.username,
    role: employee.role,
    tenant_id: employee.tenant_id,
  })

  logAudit({ id: employee.id, name: employee.name, tenant_id: employee.tenant_id },
    'employee_login', null, { ip, username: employee.username, totp: true })

  const res = NextResponse.json({ success: true, role: employee.role })
  res.cookies.set('ponto_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return res
}
