import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'

function parseTime(t: string | null | undefined): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ error: 'from and to required' }, { status: 400 })

  const [{ data: employees }, { data: records }] = await Promise.all([
    supabase.from('employees')
      .select('id, name, expected_start')
      .eq('tenant_id', user.tenant_id)
      .eq('active', true),
    supabase.from('records')
      .select('employee_id, type, timestamp, date')
      .eq('tenant_id', user.tenant_id)
      .gte('date', from)
      .lte('date', to)
      .eq('type', 'entrada')
      .order('timestamp', { ascending: true }),
  ])

  // Group first entrada per employee per day
  const firstEntry = new Map<string, Map<string, number>>() // empId → date → minutesOfDay
  ;(records ?? []).forEach((r: { employee_id: string; type: string; timestamp: string; date: string }) => {
    if (!firstEntry.has(r.employee_id)) firstEntry.set(r.employee_id, new Map())
    const empMap = firstEntry.get(r.employee_id)!
    if (!empMap.has(r.date)) {
      const t = new Date(r.timestamp)
      empMap.set(r.date, t.getHours() * 60 + t.getMinutes())
    }
  })

  const rows = (employees ?? []).map(emp => {
    const expectedMin = parseTime(emp.expected_start)
    const entries = firstEntry.get(emp.id)
    if (!entries || entries.size === 0) return { empId: emp.id, name: emp.name, expected_start: emp.expected_start, total_days: 0, on_time: 0, late: 0, avg_late_min: 0 }

    let onTime = 0, late = 0, totalLateMin = 0
    entries.forEach(actualMin => {
      if (expectedMin == null) { onTime++; return }
      if (actualMin <= expectedMin + 5) { onTime++ } // 5 min grace
      else { late++; totalLateMin += actualMin - expectedMin }
    })
    return {
      empId: emp.id,
      name: emp.name,
      expected_start: emp.expected_start,
      total_days: entries.size,
      on_time: onTime,
      late,
      avg_late_min: late > 0 ? Math.round(totalLateMin / late) : 0,
    }
  }).filter(r => r.total_days > 0)

  rows.sort((a, b) => b.late - a.late)
  return NextResponse.json(rows)
}
