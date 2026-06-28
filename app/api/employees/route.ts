import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { getEmployees } from '@/lib/data/employees'
import bcrypt from 'bcryptjs'

async function requireAdmin() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return user.role === 'admin' ? user : null
  } catch { return null }
}

async function requirePrivileged() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return ['admin', 'manager'].includes(user.role) ? user : null
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const actor = await requirePrivileged()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ?all=true includes deactivated employees (the Funcionários tab's trash
  // bin). Default stays active-only so dashboards, pickers and the kiosk
  // never see inactive people.
  const includeInactive = new URL(request.url).searchParams.get('all') === 'true'

  const data = await getEmployees(actor, { includeInactive })
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' },
  })
}

export async function POST(request: NextRequest) {
  const actor = await requireAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, username, email, password, role, workday_hours, lunch_break_minutes, hourly_rate } = await request.json()

  if (!name || !username || !password)
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })

  const trimmedName = String(name).trim()
  const trimmedUsername = String(username).trim().toLowerCase()

  if (trimmedName.length < 2 || trimmedName.length > 100)
    return NextResponse.json({ error: 'Nome deve ter entre 2 e 100 caracteres' }, { status: 400 })

  if (trimmedUsername.length < 3 || trimmedUsername.length > 50)
    return NextResponse.json({ error: 'Usuário deve ter entre 3 e 50 caracteres' }, { status: 400 })

  if (!/^[a-z0-9._-]+$/.test(trimmedUsername))
    return NextResponse.json({ error: 'Usuário só pode conter letras, números, ponto, hífen e underscore' }, { status: 400 })

  if (password.length < 6 || password.length > 100)
    return NextResponse.json({ error: 'Senha deve ter entre 6 e 100 caracteres' }, { status: 400 })

  if (!['admin', 'manager', 'employee'].includes(role))
    return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })

  const parsedWorkday = Number(workday_hours ?? 8)
  const parsedLunch   = Number(lunch_break_minutes ?? 60)
  const parsedRate    = hourly_rate != null ? Number(hourly_rate) : null

  if (isNaN(parsedWorkday) || parsedWorkday < 1 || parsedWorkday > 24)
    return NextResponse.json({ error: 'Jornada inválida' }, { status: 400 })
  if (isNaN(parsedLunch) || parsedLunch < 0 || parsedLunch > 120)
    return NextResponse.json({ error: 'Desconto de almoço inválido' }, { status: 400 })
  if (parsedRate !== null && (isNaN(parsedRate) || parsedRate < 0))
    return NextResponse.json({ error: 'Valor da hora inválido' }, { status: 400 })

  const trimmedEmail = email ? String(email).trim().toLowerCase() : null
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

  // Username uniqueness is tenant-scoped now (employees_tenant_username_key).
  const { data: existing } = await supabase
    .from('employees').select('id')
    .eq('tenant_id', actor.tenant_id)
    .eq('username', trimmedUsername).single()

  if (existing)
    return NextResponse.json({ error: 'Usuário já existe' }, { status: 400 })

  const hash = await bcrypt.hash(password, 10)
  const { data, error } = await supabase
    .from('employees')
    .insert({
      tenant_id: actor.tenant_id,
      name: trimmedName, username: trimmedUsername, email: trimmedEmail, password_hash: hash, role,
      workday_hours: parsedWorkday, lunch_break_minutes: parsedLunch, hourly_rate: parsedRate,
    })
    .select('id, name, username, email, role, active, created_at, workday_hours, lunch_break_minutes, hourly_rate, geo_mode')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(actor, 'employee_create', { id: data.id, name: data.name }, { role })
  return NextResponse.json(data, { status: 201 })
}
