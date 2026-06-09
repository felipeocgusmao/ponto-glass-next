import { supabase } from './supabase'
import { DEFAULT_TENANT_ID } from './tenant'
import type { JWTUser } from './types'

// Actor must carry id + name; tenant_id is optional only for legacy callers
// (bootstrap admin seed, cron jobs that use a synthetic system actor).
type Actor = Pick<JWTUser, 'id' | 'name'> & { tenant_id?: string }

export async function logAudit(
  actor: Actor,
  action: string,
  target?: { id: string; name: string } | null,
  details?: Record<string, unknown>,
) {
  try {
    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_name: actor.name,
      tenant_id: actor.tenant_id ?? DEFAULT_TENANT_ID,
      action,
      target_id: target?.id ?? null,
      target_name: target?.name ?? null,
      details: details ?? null,
    })
  } catch { /* non-blocking — audit failure must not break main flow */ }
}
