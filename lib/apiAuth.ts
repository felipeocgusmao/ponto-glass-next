import { supabase } from './supabase'
import { verifyJWTWithMeta } from './auth'
import { DEFAULT_TENANT_ID } from './tenant'
import type { ApiUser } from './types'

// Verify a token for API access: valid signature + not expired (verifyJWTWithMeta), the
// account is still active, and the token was issued at/after the user's `sessions_valid_from`
// — so logout and password changes revoke any token minted earlier. Throws on any failure;
// callers already map a throw to 401.
//
// Resilient by design: if a column doesn't exist yet (migration not applied) or the lookup
// hits a transient error, it degrades to signature-only auth with the default tenant rather
// than locking everyone out. Once the migration runs, real values take over automatically.
export async function verifyApiAuth(token: string): Promise<ApiUser> {
  const { user, iat } = await verifyJWTWithMeta(token)

  // Newest column set first, with the tenant's active flag embedded through the
  // tenant_id FK — one round trip instead of a follow-up tenants query, on a path
  // that runs for every authenticated request (the extra serial query was pure
  // TTFB). Retry without super_admin/embed for databases that haven't run the
  // phase-5 (or multi-tenancy) migrations yet, so revocation keeps working there.
  let row = await supabase
    .from('employees')
    .select('active, sessions_valid_from, tenant_id, super_admin, tenant:tenants(active, trial_ends_at)')
    .eq('id', user.id)
    .maybeSingle()
  if (row.error) {
    row = await supabase
      .from('employees')
      .select('active, sessions_valid_from, tenant_id')
      .eq('id', user.id)
      .maybeSingle()
  }
  const { data, error } = row

  // Column missing / transient error: fall back to the JWT-claimed tenant_id, or the
  // well-known default if even that isn't there (pre-phase-2 tokens). Don't lock users out.
  if (error) return { ...user, tenant_id: user.tenant_id ?? DEFAULT_TENANT_ID, super_admin: false }
  if (!data) throw new Error('Unknown user')
  if (data.active === false) throw new Error('Account inactive')

  const validFrom = data.sessions_valid_from
    ? Math.floor(new Date(data.sessions_valid_from as string).getTime() / 1000)
    : 0
  if (iat < validFrom) throw new Error('Session revoked')

  // The database is the source of truth for tenant membership and platform
  // scope. If a token were forged with a different tenant_id (would require
  // leaking JWT_SECRET), the DB value still wins and limits the blast radius
  // to whatever the actual employee row allows.
  const fields = data as { tenant_id?: string; super_admin?: boolean; tenant?: { active?: boolean; trial_ends_at?: string | null } | null }
  const tenantId = fields.tenant_id ?? user.tenant_id ?? DEFAULT_TENANT_ID
  const superAdmin = fields.super_admin === true

  if (!superAdmin && tenantId !== DEFAULT_TENANT_ID) {
    let tenantActive = fields.tenant?.active
    let trialEndsAt = fields.tenant?.trial_ends_at
    if (fields.tenant === undefined) {
      const { data: tenant, error: tenantErr } = await supabase
        .from('tenants')
        .select('active, trial_ends_at')
        .eq('id', tenantId)
        .maybeSingle()
      tenantActive = tenantErr ? undefined : tenant?.active
      trialEndsAt = tenantErr ? undefined : tenant?.trial_ends_at
    }
    if (tenantActive === false) throw new Error('Tenant inactive')
    if (trialEndsAt && new Date(trialEndsAt) < new Date()) throw new Error('Trial expired')
  }

  return {
    ...user,
    tenant_id: tenantId,
    super_admin: superAdmin,
  }
}
