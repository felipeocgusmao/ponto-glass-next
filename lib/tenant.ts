// Multi-tenancy constants and helpers.

import type { NextRequest } from 'next/server'

// Deterministic id of the default tenant created by migration 20260609.
// Every row that pre-dates multi-tenancy belongs here, and every legacy INSERT
// that omits tenant_id picks it up via the column DEFAULT.
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Decide which tenant a login attempt belongs to.
 *
 * Phase 2: there is only one tenant in production (the default), so we always
 * return it. Phase 4 will swap this for a host-based lookup so
 * `empresa-a.pontoglass.app` and `empresa-b.pontoglass.app` resolve to
 * different tenant ids before the username is matched.
 *
 * Keep the signature stable now so phase 2 callers (login, forgot-password,
 * recover) don't need to change again in phase 4.
 */
// The argument will be used in phase 4 to resolve the tenant from the host.
// Kept in the signature now so callers are already wired correctly.
export async function resolveLoginTenant(request: NextRequest): Promise<string> {
  void request
  return DEFAULT_TENANT_ID
}
