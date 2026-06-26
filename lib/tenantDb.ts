import { supabase } from './supabase'

// Thin wrapper around the Supabase service-role client that auto-injects
// `.eq('tenant_id', tenantId)` on every query, preventing cross-tenant
// data leaks when the caller forgets to filter manually.
export function tenantDb(tenantId: string) {
  return {
    from(table: string) {
      return {
        select(columns = '*') {
          return supabase.from(table).select(columns).eq('tenant_id', tenantId)
        },
        insert(data: Record<string, unknown> | Record<string, unknown>[]) {
          const rows = Array.isArray(data)
            ? data.map(r => ({ ...r, tenant_id: tenantId }))
            : { ...(data as Record<string, unknown>), tenant_id: tenantId }
          return supabase.from(table).insert(rows)
        },
        update(data: Record<string, unknown>) {
          return supabase.from(table).update(data).eq('tenant_id', tenantId)
        },
        delete() {
          return supabase.from(table).delete().eq('tenant_id', tenantId)
        },
      }
    },
  }
}
