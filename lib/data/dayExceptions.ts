import { supabase } from '@/lib/supabase'
import type { ApiUser, DayException } from '@/lib/types'

// Tenant-scoped day exceptions (holidays / days off) for Server Components that
// seed the admin dashboard. Mirrors the /api/day-exceptions GET query (which keeps
// its own error handling); on failure this degrades to an empty list so the page
// still renders. Non-privileged users only see global exceptions and their own
// personal day_off entries — never colleagues'.
export async function getDayExceptions(
  user: ApiUser,
  opts: { from?: string; to?: string } = {},
): Promise<DayException[]> {
  let query = supabase
    .from('day_exceptions')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('date', { ascending: false })
    .limit(200)

  if (!['admin', 'manager'].includes(user.role))
    query = query.or(`employee_id.is.null,employee_id.eq.${user.id}`)

  if (opts.from) query = query.gte('date', opts.from)
  if (opts.to)   query = query.lte('date', opts.to)

  const { data } = await query
  return (data ?? []) as DayException[]
}
