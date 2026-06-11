import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { generateTotpSecret, totpKeyUri, verifyTotpCode } from '@/lib/totp'

// Self-service TOTP management for the logged-in user.
//   GET            → { enabled, pending }
//   POST setup     → generates a secret (enabled stays false), returns otpauth URI
//   POST enable    → { code } confirms the pending secret and turns 2FA on
//   POST disable   → { code } turns 2FA off (requires a valid current code)
// Lost authenticator: an admin clears it via PATCH /api/employees/[id]
// { reset_totp: true } — there is deliberately no self-service path without a code.
export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { data } = await supabase
    .from('employees')
    .select('totp_enabled, totp_secret')
    .eq('tenant_id', user.tenant_id)
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({
    enabled: data?.totp_enabled === true,
    pending: data?.totp_enabled !== true && !!data?.totp_secret,
  })
}

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { action, code } = await request.json()

  const { data: emp } = await supabase
    .from('employees')
    .select('totp_secret, totp_enabled')
    .eq('tenant_id', user.tenant_id)
    .eq('id', user.id)
    .single()
  if (!emp) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  if (action === 'setup') {
    if (emp.totp_enabled)
      return NextResponse.json({ error: '2FA já está ativo. Desative antes de reconfigurar.' }, { status: 400 })
    const secret = generateTotpSecret()
    const { error } = await supabase
      .from('employees')
      .update({ totp_secret: secret, totp_enabled: false })
      .eq('tenant_id', user.tenant_id)
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ secret, uri: totpKeyUri(user.username, secret) })
  }

  if (action === 'enable') {
    if (emp.totp_enabled) return NextResponse.json({ ok: true })
    if (!emp.totp_secret)
      return NextResponse.json({ error: 'Inicie a configuração primeiro.' }, { status: 400 })
    if (!verifyTotpCode(code, emp.totp_secret))
      return NextResponse.json({ error: 'Código inválido. Confira o aplicativo autenticador.' }, { status: 400 })
    const { error } = await supabase
      .from('employees')
      .update({ totp_enabled: true })
      .eq('tenant_id', user.tenant_id)
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAudit(user, 'totp_enabled', null)
    return NextResponse.json({ ok: true })
  }

  if (action === 'disable') {
    if (!emp.totp_enabled) return NextResponse.json({ ok: true })
    if (!verifyTotpCode(code, emp.totp_secret ?? ''))
      return NextResponse.json({ error: 'Código inválido. Confira o aplicativo autenticador.' }, { status: 400 })
    const { error } = await supabase
      .from('employees')
      .update({ totp_enabled: false, totp_secret: null })
      .eq('tenant_id', user.tenant_id)
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAudit(user, 'totp_disabled', null)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
