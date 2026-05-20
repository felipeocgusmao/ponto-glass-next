import { supabase } from './supabase'
import type { JWTUser } from './types'

export async function logAudit(
  actor: Pick<JWTUser, 'id' | 'name'>,
  action: string,
  target?: { id: string; name: string } | null,
  details?: Record<string, unknown>,
) {
  try {
    await supabase.from('audit_logs').insert({
      actor_id: actor.id,
      actor_name: actor.name,
      action,
      target_id: target?.id ?? null,
      target_name: target?.name ?? null,
      details: details ?? null,
    })
  } catch { /* non-blocking — audit failure must not break main flow */ }
}
