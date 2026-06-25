import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calcWorkDate } from '@/lib/utils'
import { isCsrfSafe } from '@/lib/csrf'

const VALID_TYPES = ['entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as {
    token?: string
    employee_id?: string
    type?: string
  }

  const { token, employee_id, type } = body
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
  if (!employee_id) return NextResponse.json({ error: 'employee_id required' }, { status: 400 })
  if (!type || !VALID_TYPES.includes(type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  // Resolve tenant from kiosk token
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('kiosk_token', token)
    .eq('active', true)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  // Verify employee belongs to tenant
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name, shift_start')
    .eq('id', employee_id)
    .eq('tenant_id', tenant.id)
    .eq('active', true)
    .maybeSingle()

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const timestamp = new Date()
  const date = calcWorkDate(timestamp, employee.shift_start ?? '00:00')

  const { data, error } = await supabase
    .from('records')
    .insert({
      tenant_id: tenant.id,
      employee_id: employee.id,
      employee_name: employee.name,
      type,
      timestamp: timestamp.toISOString(),
      date,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
