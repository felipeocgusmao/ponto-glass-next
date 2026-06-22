import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { createPasswordResetToken } from '@/lib/auth'
import { sendEmailVerification } from '@/lib/email'

export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  // Try the extended profile first; if a newer column is missing from the DB
  // (migration not applied), fall back to the basic set so the user can still
  // sign in instead of being kicked into a logout loop on every refresh.
  const ext = await supabase
    .from('employees')
    .select('id, name, username, role, super_admin, workday_hours, lunch_break_minutes, hourly_rate, geo_mode, email, pending_email, lock_profile, theme, expected_start, expected_end, shift_start')
    .eq('tenant_id', user.tenant_id)
    .eq('id', user.id)
    .maybeSingle()
  if (ext.data) return NextResponse.json(ext.data)

  const basic = await supabase
    .from('employees')
    .select('id, name, username, role, workday_hours, lunch_break_minutes, hourly_rate, geo_mode, email')
    .eq('tenant_id', user.tenant_id)
    .eq('id', user.id)
    .maybeSingle()
  if (!basic.data) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json(basic.data)
}

export async function PATCH(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { email, theme } = await request.json()
  const updates: Record<string, unknown> = {}

  if (theme === 'dark' || theme === 'light') updates.theme = theme

  if (email !== undefined) {
    // Email changes are a profile edit and must respect the admin lock — otherwise a locked
    // user could redirect their own password-reset emails (account-takeover vector).
    const { data: emp } = await supabase
      .from('employees')
      .select('name, lock_profile')
      .eq('tenant_id', user.tenant_id)
      .eq('id', user.id)
      .single()
    if (emp?.lock_profile === true)
      return NextResponse.json({ error: 'Edição de perfil bloqueada pelo administrador.' }, { status: 403 })

    const trimmed = email ? String(email).trim().toLowerCase() : null
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

    if (trimmed) {
      // Instead of changing the email directly, store it as pending and send a
      // confirmation link to the new address. If the columns don't exist yet
      // (migration not applied), fall back to the old direct-update behaviour.
      const token = await createPasswordResetToken(user.id, `email:${trimmed}`)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const confirmUrl = `${appUrl}/api/auth/confirm-email?token=${encodeURIComponent(token)}&tenant=${user.tenant_id}`
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      const { error: pendingError } = await supabase
        .from('employees')
        .update({ pending_email: trimmed, pending_email_token: token, pending_email_expires_at: expires })
        .eq('tenant_id', user.tenant_id)
        .eq('id', user.id)

      if (pendingError) {
        // Columns don't exist yet (migration pending) — fall back to direct update.
        updates.email = trimmed
      } else {
        await sendEmailVerification({ to: trimmed, name: emp?.name ?? user.name, confirmUrl })
        return NextResponse.json({ ok: true, pending_verification: true })
      }
    } else {
      // Clearing the email is immediate (no verification needed).
      updates.email = null
    }
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('employees')
    .update(updates)
    .eq('tenant_id', user.tenant_id)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
