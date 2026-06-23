import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { isCsrfSafe } from '@/lib/csrf'

export interface TenantAlertSettings {
  hour_bank_low_threshold: number | null   // minutes, e.g. -120 = alert when < -2h
  long_day_threshold: number | null         // minutes, e.g. 600 = alert when > 10h/day
  hour_bank_max_positive: number | null    // minutes, e.g. 1200 = cap at +20h
}

export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('tenants')
    .select('alert_settings')
    .eq('id', user.tenant_id)
    .maybeSingle()

  const settings: TenantAlertSettings = {
    hour_bank_low_threshold: null,
    long_day_threshold: null,
    hour_bank_max_positive: null,
    ...((data?.alert_settings as TenantAlertSettings | null) ?? {}),
  }
  return NextResponse.json(settings)
}

export async function PATCH(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as Partial<TenantAlertSettings>

  const { data: existing } = await supabase
    .from('tenants').select('alert_settings').eq('id', user.tenant_id).maybeSingle()

  const merged: TenantAlertSettings = {
    hour_bank_low_threshold: null,
    long_day_threshold: null,
    hour_bank_max_positive: null,
    ...((existing?.alert_settings as TenantAlertSettings | null) ?? {}),
  }

  if ('hour_bank_low_threshold' in body)
    merged.hour_bank_low_threshold = body.hour_bank_low_threshold !== undefined ? (body.hour_bank_low_threshold === null ? null : Number(body.hour_bank_low_threshold)) : merged.hour_bank_low_threshold
  if ('long_day_threshold' in body)
    merged.long_day_threshold = body.long_day_threshold !== undefined ? (body.long_day_threshold === null ? null : Number(body.long_day_threshold)) : merged.long_day_threshold
  if ('hour_bank_max_positive' in body)
    merged.hour_bank_max_positive = body.hour_bank_max_positive !== undefined ? (body.hour_bank_max_positive === null ? null : Number(body.hour_bank_max_positive)) : merged.hour_bank_max_positive

  const { error } = await supabase
    .from('tenants')
    .update({ alert_settings: merged })
    .eq('id', user.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(merged)
}
