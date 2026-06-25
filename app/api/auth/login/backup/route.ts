import { NextRequest, NextResponse } from 'next/server'
import { createJWT, verifyTotpPendingToken } from '@/lib/auth'
import { findMatchingBackupCode } from '@/lib/totp'
import { supabase } from '@/lib/supabase'
import { checkRateLimit, clientIp, applyRateLimitHeaders } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'
import { isCsrfSafe } from '@/lib/csrf'

// Alternative second step for TOTP login when the authenticator device is lost.
// Uses a single-use backup code (generated when TOTP was enabled). The code is
// consumed immediately so it cannot be reused.
export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ip = clientIp(request)
  // Strict rate limit — backup codes are higher-value than TOTP codes.
  const rl = await checkRateLimit(`backup:${ip}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    const res = NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429 }
    )
    applyRateLimitHeaders(res.headers, rl)
    return res
  }

  const { pending, code } = await request.json()
  if (!pending || !code)
    return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })

  let claims: { sub: string; tid: string }
  try { claims = await verifyTotpPendingToken(String(pending)) }
  catch { return NextResponse.json({ error: 'Sessão de verificação expirada. Faça login novamente.' }, { status: 401 }) }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, username, role, tenant_id, totp_enabled, totp_backup_codes, active')
    .eq('tenant_id', claims.tid)
    .eq('id', claims.sub)
    .eq('active', true)
    .single()

  if (!employee?.totp_enabled)
    return NextResponse.json({ error: 'Sessão de verificação inválida. Faça login novamente.' }, { status: 401 })

  const hashes: string[] = Array.isArray(employee.totp_backup_codes) ? employee.totp_backup_codes : []
  if (hashes.length === 0)
    return NextResponse.json({ error: 'Não há códigos de recuperação disponíveis.' }, { status: 400 })

  const matched = findMatchingBackupCode(code, hashes)
  if (!matched)
    return NextResponse.json({ error: 'Código de recuperação inválido.' }, { status: 401 })

  // Consume the used code immediately (remove it from the stored list).
  const remaining = hashes.filter(h => h !== matched)
  await supabase
    .from('employees')
    .update({ totp_backup_codes: remaining })
    .eq('tenant_id', claims.tid)
    .eq('id', claims.sub)

  const token = await createJWT({
    id: employee.id,
    name: employee.name,
    username: employee.username,
    role: employee.role,
    tenant_id: employee.tenant_id,
  })

  logAudit(
    { id: employee.id, name: employee.name, tenant_id: employee.tenant_id },
    'employee_login',
    null,
    { ip, username: employee.username, totp: 'backup_code', remaining_backup_codes: remaining.length }
  )

  const res = NextResponse.json({ success: true, role: employee.role, remaining_backup_codes: remaining.length })
  res.cookies.set('ponto_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  applyRateLimitHeaders(res.headers, rl)
  return res
}
