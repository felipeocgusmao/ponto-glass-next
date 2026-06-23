import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'

function getWeekdays(from: string, to: string): string[] {
  const days: string[] = []
  const cur = new Date(from + 'T12:00:00')
  const end = new Date(to + 'T12:00:00')
  while (cur <= end) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
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
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 })

  const workdays = getWeekdays(from, to)
  if (workdays.length === 0) return NextResponse.json([])

  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, name')
    .eq('tenant_id', user.tenant_id)
    .eq('active', true)

  if (empErr?.code === '42P01') return NextResponse.json([])
  if (!employees?.length) return NextResponse.json([])

  const { data: records, error: recErr } = await supabase
    .from('records')
    .select('employee_id, date')
    .eq('tenant_id', user.tenant_id)
    .gte('date', from)
    .lte('date', to)

  if (recErr?.code === '42P01') return NextResponse.json([])

  const { data: exceptions, error: excErr } = await supabase
    .from('day_exceptions')
    .select('date, employee_id')
    .eq('tenant_id', user.tenant_id)
    .gte('date', from)
    .lte('date', to)

  if (excErr?.code === '42P01') return NextResponse.json([])

  // Build set of dates per employee from records
  const presentDates = new Map<string, Set<string>>()
  for (const r of (records ?? []) as { employee_id: string; date: string }[]) {
    if (!presentDates.has(r.employee_id)) presentDates.set(r.employee_id, new Set())
    presentDates.get(r.employee_id)!.add(r.date)
  }

  // Build day exceptions: set of dates that are excused globally or per employee
  const globalExceptions = new Set<string>()
  const empExceptions = new Map<string, Set<string>>()
  for (const e of (exceptions ?? []) as { date: string; employee_id: string | null }[]) {
    if (e.employee_id == null) {
      globalExceptions.add(e.date)
    } else {
      if (!empExceptions.has(e.employee_id)) empExceptions.set(e.employee_id, new Set())
      empExceptions.get(e.employee_id)!.add(e.date)
    }
  }

  const result: { empId: string; name: string; absent_count: number; absent_days: string[] }[] = []

  for (const emp of employees as { id: string; name: string }[]) {
    const present = presentDates.get(emp.id) ?? new Set<string>()
    const absent_days = workdays.filter(d => {
      if (present.has(d)) return false
      if (globalExceptions.has(d)) return false
      if (empExceptions.get(emp.id)?.has(d)) return false
      return true
    })
    if (absent_days.length > 0) {
      result.push({ empId: emp.id, name: emp.name, absent_count: absent_days.length, absent_days })
    }
  }

  result.sort((a, b) => b.absent_count - a.absent_count)
  return NextResponse.json(result)
}
