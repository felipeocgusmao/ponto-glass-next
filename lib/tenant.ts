// Multi-tenancy constants and helpers.

import type { NextRequest } from 'next/server'
import { supabase } from './supabase'

// Deterministic id of the default tenant created by migration 20260609.
// Every row that pre-dates multi-tenancy belongs here, and every legacy INSERT
// that omits tenant_id picks it up via the column DEFAULT.
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

// Root domain that serves one subdomain per tenant (e.g. 'pontoglass.app' →
// empresa-a.pontoglass.app). Optional: when unset, subdomain routing is off and
// every host resolves to the default tenant (single-tenant behaviour).
const TENANT_ROOT_DOMAIN = (process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN ?? '').toLowerCase()

/** Same rule as the DB CHECK constraint on tenants.slug: lowercase a-z0-9
 * with internal hyphens, 2-40 chars. 'www' is reserved (the apex alias). */
export function isValidTenantSlug(slug: unknown): slug is string {
  return typeof slug === 'string'
    && slug.length >= 2 && slug.length <= 40
    && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
    && slug !== 'www'
}

/** Ids of every active tenant — what the cron jobs iterate over. Falls back
 * to the default tenant when the table is missing (pre-phase-1 databases) or
 * the lookup fails, preserving single-tenant behaviour. */
export async function activeTenantIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true)
  if (error || !data?.length) return [DEFAULT_TENANT_ID]
  return data.map(t => t.id)
}

/** Hostname of the request, lowercased, without port. Vercel forwards the
 * original host in x-forwarded-host; plain `host` covers local dev. */
export function requestHost(request: NextRequest): string {
  const raw = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  return raw.split(',')[0].trim().split(':')[0].toLowerCase()
}

/**
 * Decide which tenant a login attempt belongs to, based on the host the user
 * is visiting (phase 4 of issue #6 / closes issue #5):
 *
 *   0. An explicit slug (the login form's `tenant` field, fed by
 *      /login?tenant=<slug>) wins over host resolution. It lets a tenant
 *      without its own domain/subdomain be reached from the main host —
 *      the demo tenant being the canonical case. Unknown slug → null,
 *      same refusal semantics as the subdomain path.
 *   1. A registered custom domain (tenants.domain = host) wins.
 *   2. `<slug>.<TENANT_ROOT_DOMAIN>` resolves by slug. A slug that matches no
 *      active tenant returns null — the caller should refuse the login rather
 *      than silently authenticating against the wrong company.
 *   3. Everything else (apex, www, localhost, *.vercel.app previews, or when
 *      TENANT_ROOT_DOMAIN is unset) falls back to the default tenant, which
 *      preserves single-tenant behaviour exactly.
 *
 * Session isolation between subdomains does not depend on this function:
 * the `ponto_token` cookie is host-only (no Domain attribute), so it never
 * travels to a sibling subdomain, and every API query filters by the
 * tenant_id embedded in the JWT at login.
 */
export async function resolveLoginTenant(request: NextRequest, explicitSlug?: unknown): Promise<string | null> {
  // 0. Explicit tenant slug from the login form. Only well-formed slugs are
  // looked up; anything else falls through to host resolution so a malformed
  // value degrades to the pre-existing behaviour instead of a hard refusal.
  if (isValidTenantSlug(explicitSlug)) {
    const { data: bySlug } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', explicitSlug)
      .eq('active', true)
      .maybeSingle()
    return bySlug?.id ?? null
  }

  const host = requestHost(request)
  if (!host) return DEFAULT_TENANT_ID

  // 1. Custom domain (ponto.empresa.com). Lookup failures (table missing
  // pre-migration, transient errors) degrade to the default tenant — login
  // must keep working on single-tenant deployments that never ran phase 1.
  const { data: byDomain } = await supabase
    .from('tenants')
    .select('id')
    .eq('domain', host)
    .eq('active', true)
    .maybeSingle()
  if (byDomain?.id) return byDomain.id

  // 2. Slug subdomain under the configured root domain.
  if (TENANT_ROOT_DOMAIN && host.endsWith(`.${TENANT_ROOT_DOMAIN}`)) {
    const slug = host.slice(0, -(TENANT_ROOT_DOMAIN.length + 1))
    // The apex and www serve the main (default) app, not a tenant.
    if (!slug || slug === 'www') return DEFAULT_TENANT_ID
    // Nested subdomains (a.b.root) are not tenant slugs.
    if (slug.includes('.')) return DEFAULT_TENANT_ID

    const { data: bySlug } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle()
    // Unknown slug: refuse instead of falling back — authenticating a user
    // against the default tenant while the URL claims another company would
    // be a confusing (and dangerous) mismatch.
    return bySlug?.id ?? null
  }

  // 3. Anything else: single-tenant behaviour.
  return DEFAULT_TENANT_ID
}
