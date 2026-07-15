import { supabase } from '@/lib/supabase'
import type { ApiUser, EmployeeProfile } from '@/lib/types'

// Single source of truth for loading an employee's own profile. Used both by the
// /api/me route and by Server Components that need the profile at render time
// (no client-side useEffect round-trip).
//
// Tries the extended column set first; if a newer column is missing because the
// migration hasn't been applied yet, falls back to the basic set so the user can
// still load instead of being kicked into a logout loop.
export async function getEmployeeProfile(user: ApiUser): Promise<EmployeeProfile | null> {
  const [ext, tenant] = await Promise.all([
    supabase
      .from('employees')
      .select('id, name, username, role, super_admin, workday_hours, lunch_break_minutes, hourly_rate, geo_mode, email, pending_email, lock_profile, theme, expected_start, expected_end, shift_start, weekly_schedule, works_holidays')
      .eq('tenant_id', user.tenant_id)
      .eq('id', user.id)
      .maybeSingle(),
    // Company compliance opt-in (#285) rides along so /ponto can show the
    // rest-break warning without an extra admin-only settings call.
    supabase.from('tenants').select('alert_settings').eq('id', user.tenant_id).maybeSingle(),
  ])
  const ptCompliance = Boolean(
    (tenant.data?.alert_settings as { pt_compliance?: boolean } | null)?.pt_compliance
  )
  if (ext.data) return { ...(ext.data as unknown as EmployeeProfile), pt_compliance: ptCompliance }

  const basic = await supabase
    .from('employees')
    .select('id, name, username, role, workday_hours, lunch_break_minutes, hourly_rate, geo_mode, email')
    .eq('tenant_id', user.tenant_id)
    .eq('id', user.id)
    .maybeSingle()
  if (!basic.data) return null
  return { ...(basic.data as unknown as EmployeeProfile), pt_compliance: ptCompliance }
}
