import { supabase } from '@/lib/supabase'
import type { ApiUser } from '@/lib/types'

// Count of pending correction requests for the actor's tenant. Privileged users
// (admin/manager) see the whole tenant — the admin shell only renders for them —
// so this powers the sidebar badge without pulling every row.
export async function getPendingCorrectionsCount(user: ApiUser): Promise<number> {
  const { count } = await supabase
    .from('correction_requests')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', user.tenant_id)
    .eq('status', 'pending')
  return count ?? 0
}
