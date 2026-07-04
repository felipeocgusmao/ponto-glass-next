import { supabase } from '@/lib/supabase'
import { calcWorkDate } from '@/lib/utils'
import type { ApiUser, PunchRecord } from '@/lib/types'

// Today's punches for a single employee, shift-aware (a night-shift punch after
// midnight is filed under the day the shift began — matches the write path and
// the /api/records "today" filter). Tenant-scoped. Shared by the /api/records
// route and by Server Components that render the punch screen.
export async function getTodayRecordsForEmployee(user: ApiUser, employeeId: string): Promise<PunchRecord[]> {
  const { data: emp } = await supabase
    .from('employees')
    .select('shift_start')
    .eq('tenant_id', user.tenant_id)
    .eq('id', employeeId)
    .single()

  const date = calcWorkDate(new Date(), emp?.shift_start ?? '00:00')

  const { data } = await supabase
    .from('records')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('employee_id', employeeId)
    .eq('date', date)
    .order('timestamp', { ascending: true })

  return (data ?? []) as PunchRecord[]
}

// Today's punches for every active employee in the tenant, shift-aware. Each
// employee's "today" is resolved against their own shift_start, so a night-shift
// worker's in-progress day doesn't vanish at midnight. Powers the kiosk board and
// the admin "today / all" view.
export async function getTodayRecordsAllEmployees(user: ApiUser): Promise<PunchRecord[]> {
  const { data: emps } = await supabase
    .from('employees')
    .select('id, shift_start')
    .eq('tenant_id', user.tenant_id)
    .eq('active', true)

  const now = new Date()
  const clauses = (emps ?? []).map(
    e => `and(employee_id.eq.${e.id},date.eq.${calcWorkDate(now, e.shift_start ?? '00:00')})`,
  )
  if (clauses.length === 0) return []

  const { data } = await supabase
    .from('records')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .or(clauses.join(','))
    .order('timestamp', { ascending: true })

  return (data ?? []) as PunchRecord[]
}

// All of a tenant's punches inside [from, to] — the admin dashboard's chart window.
// Same shape /api/reports returns; the cap matches that route's MAX_PAGE_SIZE so the
// server-seeded first paint and the client's 60s refresh agree on truncation.
export const RANGE_CAP = 2000

export async function getRecordsRange(user: ApiUser, from: string, to: string): Promise<PunchRecord[]> {
  const { data } = await supabase
    .from('records')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .gte('date', from)
    .lte('date', to)
    .order('timestamp', { ascending: true })
    .limit(RANGE_CAP)

  return (data ?? []) as PunchRecord[]
}
