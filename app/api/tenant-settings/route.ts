import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { isCsrfSafe } from '@/lib/csrf'

export interface TenantAlertSettings {
  hour_bank_low_threshold: number | null   // minutes, e.g. -120 = alert when < -2h
  long_day_threshold: number | null         // minutes, e.g. 600 = alert when > 10h/day
  hour_bank_max_positive: number | null    // minutes, e.g. 1200 = cap at +20h
  // Company-wide defaults pre-filled when creating a new employee. Stored in the
  // same tenants.alert_settings JSONB (no migration needed). null → the UI falls
  // back to 8h / 60min.
  default_workday_hours: number | null       // hours/day, e.g. 8
  default_lunch_break_minutes: number | null // minutes, e.g. 60
}

const EMPTY_SETTINGS: TenantAlertSettings = {
  hour_bank_low_threshold: null,
  long_day_threshold: null,
  hour_bank_max_positive: null,
  default_workday_hours: null,
  default_lunch_break_minutes: null,
}

// clamp a numeric input to [min, max]; null passes through (means "unset").
function clampOrNull(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  if (Number.isNaN(n)) return null
  return Math.min(max, Math.max(min, n))
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
    ...EMPTY_SETTINGS,
    ...((data?.alert_settings as Partial<TenantAlertSettings> | null) ?? {}),
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
    ...EMPTY_SETTINGS,
    ...((existing?.alert_settings as Partial<TenantAlertSettings> | null) ?? {}),
  }

  // Present in body (even as null) → set it; null clears the threshold.
  if ('hour_bank_low_threshold' in body) merged.hour_bank_low_threshold = body.hour_bank_low_threshold === null ? null : Number(body.hour_bank_low_threshold)
  if ('long_day_threshold' in body) merged.long_day_threshold = body.long_day_threshold === null ? null : Number(body.long_day_threshold)
  if ('hour_bank_max_positive' in body) merged.hour_bank_max_positive = body.hour_bank_max_positive === null ? null : Number(body.hour_bank_max_positive)
  // Journey defaults are clamped to sane ranges so a bad value can't poison
  // every future employee.
  if ('default_workday_hours' in body) merged.default_workday_hours = clampOrNull(body.default_workday_hours, 1, 24)
  if ('default_lunch_break_minutes' in body) merged.default_lunch_break_minutes = clampOrNull(body.default_lunch_break_minutes, 0, 240)

  const { error } = await supabase
    .from('tenants')
    .update({ alert_settings: merged })
    .eq('id', user.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(merged)
}
