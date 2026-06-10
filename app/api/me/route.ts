import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'

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
    .select('id, name, username, role, super_admin, workday_hours, lunch_break_minutes, hourly_rate, geo_mode, email, lock_profile, theme, expected_start, expected_end, shift_start')
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
      .select('lock_profile')
      .eq('tenant_id', user.tenant_id)
      .eq('id', user.id)
      .single()
    if (emp?.lock_profile === true)
      return NextResponse.json({ error: 'Edição de perfil bloqueada pelo administrador.' }, { status: 403 })

    const trimmed = email ? String(email).trim().toLowerCase() : null
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    updates.email = trimmed
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
