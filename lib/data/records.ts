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
