import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

async function requireSuperAdmin(): Promise<ApiUser | null> {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return user.role === 'admin' && user.super_admin ? user : null
  } catch { return null }
}

// GET — list all admins and managers of a tenant
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, username, email, role, active, created_at')
    .eq('tenant_id', params.id)
    .in('role', ['admin', 'manager'])
    .order('role').order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new admin in a tenant
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, username, password, role } = await request.json()

  if (!name || !username || !password)
    return NextResponse.json({ error: 'name, username e password são obrigatórios' }, { status: 400 })

  const trimmedName = String(name).trim()
  const trimmedUsername = String(username).trim().toLowerCase()
  const assignedRole = ['admin', 'manager'].includes(role) ? role : 'admin'

  if (typeof password !== 'string' || password.length < 6)
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })

  const hash = await bcrypt.hash(password, 10)
  const { data, error } = await supabase.from('employees').insert({
    tenant_id: params.id,
    name: trimmedName,
    username: trimmedUsername,
    password_hash: hash,
    role: assignedRole,
    active: true,
  }).select('id, name, username, role, active').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(actor, 'super_admin_create_admin',
    { id: data.id, name: data.name },
    { username: trimmedUsername, role: assignedRole, tenant_id: params.id }
  )

  return NextResponse.json(data, { status: 201 })
}

// PATCH — toggle active for an admin
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { employee_id, active } = await request.json()
  if (!employee_id || typeof active !== 'boolean')
    return NextResponse.json({ error: 'employee_id e active são obrigatórios' }, { status: 400 })

  const { data: emp } = await supabase.from('employees')
    .select('name').eq('id', employee_id).eq('tenant_id', params.id).single()
  if (!emp) return NextResponse.json({ error: 'Utilizador não encontrado nesta empresa' }, { status: 404 })

  const { error } = await supabase.from('employees')
    .update({ active }).eq('id', employee_id).eq('tenant_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(actor, active ? 'super_admin_activate_admin' : 'super_admin_deactivate_admin',
    { id: employee_id, name: emp.name }, { tenant_id: params.id }
  )

  return NextResponse.json({ success: true })
}
