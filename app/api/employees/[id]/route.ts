import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name: new_name, username: new_username, email, role, workday_hours, lunch_break_minutes, hourly_rate, new_password, geo_mode } = await request.json()

  const updates: Record<string, unknown> = {}

  if (new_name !== undefined) {
    const trimmed = String(new_name).trim()
    if (trimmed.length < 2 || trimmed.length > 100)
      return NextResponse.json({ error: 'Nome deve ter entre 2 e 100 caracteres' }, { status: 400 })
    updates.name = trimmed
  }

  if (role !== undefined) {
    if (!['admin', 'manager', 'employee'].includes(role))
      return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
    if (role !== 'admin') {
      const { data: target } = await supabase.from('employees').select('role').eq('id', params.id).single()
      if (target?.role === 'admin') {
        const { count } = await supabase
          .from('employees').select('*', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true)
        if ((count ?? 0) <= 1)
          return NextResponse.json({ error: 'Não é possível rebaixar o último administrador' }, { status: 400 })
      }
    }
    updates.role = role
  }

  if (new_username !== undefined) {
    const trimmed = String(new_username).trim().toLowerCase()
    if (trimmed.length < 3 || trimmed.length > 50)
      return NextResponse.json({ error: 'Usuário deve ter entre 3 e 50 caracteres' }, { status: 400 })
    if (!/^[a-z0-9._-]+$/.test(trimmed))
      return NextResponse.json({ error: 'Usuário só pode conter letras, números, ponto, hífen e underscore' }, { status: 400 })
    const { data: existing } = await supabase
      .from('employees').select('id').eq('username', trimmed).single()
    if (existing && existing.id !== params.id)
      return NextResponse.json({ error: 'Usuário já está em uso' }, { status: 400 })
    updates.username = trimmed
  }

  if (new_password !== undefined) {
    if (typeof new_password !== 'string' || new_password.length < 6 || new_password.length > 100)
      return NextResponse.json({ error: 'Senha deve ter entre 6 e 100 caracteres' }, { status: 400 })
    updates.password_hash = await bcrypt.hash(new_password, 10)
  }

  if (workday_hours !== undefined) {
    const parsedWorkday = Number(workday_hours)
    if (isNaN(parsedWorkday) || parsedWorkday < 1 || parsedWorkday > 24)
      return NextResponse.json({ error: 'Jornada inválida' }, { status: 400 })
    updates.workday_hours = parsedWorkday
  }

  if (lunch_break_minutes !== undefined) {
    const parsedLunch = Number(lunch_break_minutes)
    if (isNaN(parsedLunch) || parsedLunch < 0 || parsedLunch > 120)
      return NextResponse.json({ error: 'Desconto de almoço inválido' }, { status: 400 })
    updates.lunch_break_minutes = parsedLunch
  }

  if (hourly_rate !== undefined) {
    const parsedRate = hourly_rate !== '' && hourly_rate !== null ? Number(hourly_rate) : null
    if (parsedRate !== null && (isNaN(parsedRate) || parsedRate < 0))
      return NextResponse.json({ error: 'Valor da hora inválido' }, { status: 400 })
    updates.hourly_rate = parsedRate
  }

  if (geo_mode !== undefined) {
    if (!['required', 'optional', 'disabled'].includes(geo_mode))
      return NextResponse.json({ error: 'Modo de geolocalização inválido' }, { status: 400 })
    updates.geo_mode = geo_mode
  }

  if (email !== undefined) {
    const trimmedEmail = email ? String(email).trim().toLowerCase() : null
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    updates.email = trimmedEmail
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', params.id)
    .select('id, name, username, email, role, active, created_at, workday_hours, lunch_break_minutes, hourly_rate, geo_mode')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, 'employee_update', { id: params.id, name: data.name }, {
    fields: Object.keys(updates).filter(k => k !== 'password_hash'),
  })

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (params.id === user.id) return NextResponse.json({ error: 'Não é possível desativar sua própria conta' }, { status: 400 })

  const { data: target } = await supabase
    .from('employees')
    .select('role')
    .eq('id', params.id)
    .single()

  if (!target) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  if (target.role === 'admin') {
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('active', true)

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Não é possível remover o último administrador' },
        { status: 400 }
      )
    }
  }

  const { data: emp } = await supabase.from('employees').select('name').eq('id', params.id).single()

  const { error } = await supabase
    .from('employees')
    .update({ active: false })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (emp) await logAudit(user, 'employee_delete', { id: params.id, name: emp.name })

  return NextResponse.json({ success: true })
}
