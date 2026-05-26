import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, username, role, workday_hours, lunch_break_minutes, hourly_rate, geo_mode, email, lock_profile, theme')
    .eq('id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
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
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
