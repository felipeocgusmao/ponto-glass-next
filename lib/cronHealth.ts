import { supabase } from './supabase'

// #292 — lightweight heartbeat so the admin can tell a cron is actually
// running (the switch to GitHub Actions in #288 means lembretes now depend on
// an external secret + workflow that can silently stop working — expired
// secret, a paused workflow after 60 days of repo inactivity, etc). One row
// per active tenant per invocation; cheap JSONB rows, and tenant-scoped so
// each company's admin sees a signal relevant to their own account.
export async function recordCronRun(cronName: string, tenantIds: string[]): Promise<void> {
  if (!tenantIds.length) return
  try {
    await supabase.from('audit_logs').insert(
      tenantIds.map(tenantId => ({
        tenant_id: tenantId,
        actor_id: null,
        actor_name: `cron:${cronName}`,
        action: 'cron_run',
        details: { cron: cronName },
      }))
    )
  } catch { /* non-blocking — a heartbeat failure must not break the cron itself */ }
}
