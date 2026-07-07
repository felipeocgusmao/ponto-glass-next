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

// GET — list admins of a tenant (for the reset modal)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, username, active')
    .eq('tenant_id', params.id)
    .in('role', ['admin', 'manager'])
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — reset password for a specific admin
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { employee_id, new_password } = await request.json()

  if (!employee_id || !new_password)
    return NextResponse.json({ error: 'employee_id e new_password são obrigatórios' }, { status: 400 })

  if (typeof new_password !== 'string' || new_password.length < 6)
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })

  // Verify the employee belongs to this tenant
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, username')
    .eq('id', employee_id)
    .eq('tenant_id', params.id)
    .single()

  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado nesta empresa' }, { status: 404 })

  const hash = await bcrypt.hash(new_password, 10)
  const { error } = await supabase
    .from('employees')
    .update({ password_hash: hash, sessions_valid_from: new Date().toISOString() })
    .eq('id', employee_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(actor, 'super_admin_reset_password',
    { id: employee_id, name: emp.name },
    { username: emp.username, tenant_id: params.id }
  )

  return NextResponse.json({ success: true })
}
