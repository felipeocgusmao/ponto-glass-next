import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { businessDate } from '@/lib/utils'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  // Resolve tenant from kiosk token
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('kiosk_token', token)
    .eq('active', true)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { data: employees } = await supabase
    .from('employees')
    .select('id, name')
    .eq('tenant_id', tenant.id)
    .eq('active', true)
    .eq('role', 'employee')
    .order('name')

  // Fetch today's latest record type per employee so kiosk can show status
  const today = businessDate()
  const { data: todayRecs } = await supabase
    .from('records')
    .select('employee_id, type, timestamp')
    .eq('tenant_id', tenant.id)
    .eq('date', today)
    .order('timestamp', { ascending: false })

  const lastType = new Map<string, string>()
  for (const r of todayRecs ?? []) {
    if (!lastType.has(r.employee_id)) lastType.set(r.employee_id, r.type)
  }

  const result = (employees ?? []).map(e => ({
    id: e.id,
    name: e.name,
    last_type: lastType.get(e.id) ?? null,
  }))

  return NextResponse.json(result)
}
