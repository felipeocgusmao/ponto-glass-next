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

// GET /api/tenants/search?q=<query> — search employees across all tenants
export async function GET(request: NextRequest) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, username, role, active, tenant_id, tenant:tenants(name, slug)')
    .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
    .order('name')
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
