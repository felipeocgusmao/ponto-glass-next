import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { createJWT } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { DEFAULT_TENANT_ID } from '@/lib/tenant'

const BACKUP_COOKIE = 'ponto_sa_backup'

async function requireSuperAdmin(): Promise<ApiUser | null> {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return user.role === 'admin' && user.super_admin ? user : null
  } catch { return null }
}

// POST /api/tenants/[id]/impersonate — enter a tenant as its first active admin
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (params.id === DEFAULT_TENANT_ID)
    return NextResponse.json({ error: 'Não é possível impersonar o tenant da plataforma.' }, { status: 400 })

  // Find the first active admin of the target tenant
  const { data: admin } = await supabase
    .from('employees')
    .select('id, name, username, role, tenant_id')
    .eq('tenant_id', params.id)
    .eq('role', 'admin')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!admin)
    return NextResponse.json({ error: 'Nenhum admin activo encontrado nesta empresa.' }, { status: 404 })

  const impersonateToken = await createJWT({
    id: admin.id,
    name: admin.name,
    username: admin.username,
    role: admin.role as 'admin',
    tenant_id: admin.tenant_id,
  })

  await logAudit(actor, 'super_admin_impersonate',
    { id: params.id, name: admin.username },
    { impersonated_admin: admin.username, tenant_id: params.id }
  )

  const res = NextResponse.json({ success: true, adminUsername: admin.username })

  // Back up the current SA token so the banner can restore it on exit
  const currentToken = cookies().get('ponto_token')?.value ?? ''
  res.cookies.set(BACKUP_COOKIE, currentToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  res.cookies.set('ponto_token', impersonateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return res
}

// DELETE /api/tenants/[id]/impersonate — exit impersonation, restore SA session
export async function DELETE(_request: NextRequest) {
  const backupToken = cookies().get(BACKUP_COOKIE)?.value
  if (!backupToken)
    return NextResponse.json({ error: 'Nenhuma sessão de impersonation activa.' }, { status: 400 })

  const res = NextResponse.json({ success: true })
  res.cookies.set('ponto_token', backupToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  res.cookies.delete(BACKUP_COOKIE)
  return res
}
