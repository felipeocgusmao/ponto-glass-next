import { supabase } from './supabase'
import { verifyJWTWithMeta } from './auth'
import type { JWTUser } from './types'

// Verify a token for API access: valid signature + not expired (verifyJWTWithMeta), the
// account is still active, and the token was issued at/after the user's `sessions_valid_from`
// — so logout and password changes revoke any token minted earlier. Throws on any failure;
// callers already map a throw to 401.
//
// Resilient by design: if the `sessions_valid_from` column doesn't exist yet (migration not
// applied) or the lookup hits a transient error, it degrades to signature-only auth instead
// of locking everyone out. Once the migration runs, revocation activates automatically.
export async function verifyApiAuth(token: string): Promise<JWTUser> {
  const { user, iat } = await verifyJWTWithMeta(token)

  const { data, error } = await supabase
    .from('employees')
    .select('active, sessions_valid_from')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return user // column missing / transient error → don't lock users out
  if (!data) throw new Error('Unknown user')
  if (data.active === false) throw new Error('Account inactive')

  const validFrom = data.sessions_valid_from
    ? Math.floor(new Date(data.sessions_valid_from as string).getTime() / 1000)
    : 0
  if (iat < validFrom) throw new Error('Session revoked')

  return user
}
