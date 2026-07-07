import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'

async function requireSuperAdmin(): Promise<ApiUser | null> {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return user.role === 'admin' && user.super_admin ? user : null
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '100'), 500)
  const tenantId = searchParams.get('tenant_id')

  let query = supabase
    .from('audit_logs')
    .select('*, tenant:tenants(name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
