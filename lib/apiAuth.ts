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

  const { data, error } = await supabase
    .from('employees')
    .select('active, sessions_valid_from, tenant_id')
    .eq('id', user.id)
    .maybeSingle()

  // Column missing / transient error: fall back to the JWT-claimed tenant_id, or the
  // well-known default if even that isn't there (pre-phase-2 tokens). Don't lock users out.
  if (error) return { ...user, tenant_id: user.tenant_id ?? DEFAULT_TENANT_ID }
  if (!data) throw new Error('Unknown user')
  if (data.active === false) throw new Error('Account inactive')

  const validFrom = data.sessions_valid_from
    ? Math.floor(new Date(data.sessions_valid_from as string).getTime() / 1000)
    : 0
  if (iat < validFrom) throw new Error('Session revoked')

  // The database is the source of truth for tenant membership. If a token were
  // forged with a different tenant_id (would require leaking JWT_SECRET), the
  // DB value still wins and limits the blast radius to whatever the actual
  // employee row allows.
  return { ...user, tenant_id: (data as { tenant_id?: string }).tenant_id ?? user.tenant_id ?? DEFAULT_TENANT_ID }
}
