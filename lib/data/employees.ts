import { supabase } from '@/lib/supabase'
import type { ApiUser, Employee } from '@/lib/types'

const BASE_COLS = 'id, name, username, email, role, active, created_at, workday_hours, lunch_break_minutes, hourly_rate, geo_mode'
// #287 columns — selected separately so a deployment that hasn't run the
// migration yet falls back to the base set instead of breaking every list.
const EXT_COLS = `${BASE_COLS}, lock_profile, expected_start, expected_end, shift_start, weekly_schedule, works_holidays`

// Tenant-scoped employee list, shared by the /api/employees route and Server
// Components that render the admin shell. `includeInactive` brings deactivated
// people too (the Funcionários trash bin); the default is active-only, which is
// what dashboards, pickers and the kiosk expect.
export async function getEmployees(
  user: ApiUser,
  opts: { includeInactive?: boolean } = {},
): Promise<Employee[]> {
  const run = async (cols: string) => {
    let query = supabase
      .from('employees')
      .select(cols)
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: true })
    if (!opts.includeInactive) query = query.eq('active', true)
    return query
  }

  const ext = await run(EXT_COLS)
  if (!ext.error) return (ext.data ?? []) as unknown as Employee[]

  const basic = await run(BASE_COLS)
  return (basic.data ?? []) as unknown as Employee[]
}
