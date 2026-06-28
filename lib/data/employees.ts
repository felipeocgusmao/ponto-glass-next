import { supabase } from '@/lib/supabase'
import type { ApiUser, Employee } from '@/lib/types'

// Tenant-scoped employee list, shared by the /api/employees route and Server
// Components that render the admin shell. `includeInactive` brings deactivated
// people too (the Funcionários trash bin); the default is active-only, which is
// what dashboards, pickers and the kiosk expect.
export async function getEmployees(
  user: ApiUser,
  opts: { includeInactive?: boolean } = {},
): Promise<Employee[]> {
  let query = supabase
    .from('employees')
    .select('id, name, username, email, role, active, created_at, workday_hours, lunch_break_minutes, hourly_rate, geo_mode')
    .eq('tenant_id', user.tenant_id)
    .order('created_at', { ascending: true })
  if (!opts.includeInactive) query = query.eq('active', true)

  const { data } = await query
  return (data ?? []) as unknown as Employee[]
}
