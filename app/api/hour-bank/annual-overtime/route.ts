import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { businessDate } from '@/lib/utils'
import { getAnnualOvertimeMinutes } from '@/lib/data/hourBank'
import type { TenantAlertSettings } from '../../tenant-settings/route'

// #291 — annual overtime tracking (art. 228.º CT). Bundles the tenant's
// configured limit with the computed per-employee minutes so the Banco de
// Horas tab needs one round trip instead of two.
export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const yearParam = new URL(request.url).searchParams.get('year')
  const year = yearParam ? Number(yearParam) : Number(businessDate().slice(0, 4))

  const { data: tenant } = await supabase
    .from('tenants').select('alert_settings').eq('id', user.tenant_id).maybeSingle()
  const limitMin = (tenant?.alert_settings as TenantAlertSettings | null)?.annual_overtime_limit ?? null

  const minutes = await getAnnualOvertimeMinutes(user.tenant_id, year)

  return NextResponse.json({ year, limitMin, minutes }, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
  })
}
