// Pure string helpers for tenant slug/domain input. Kept dependency-free (no
// supabase / server imports) so client components can import them without
// pulling server-only code into the browser bundle.

/** Turn whatever the user pasted into a bare custom domain. Accepts full URLs
 * ("https://www.sscar.pt/", "sscar.pt/ponto") and strips the protocol, a
 * leading "www.", any path/query, and trailing dots — so pasting a browser URL
 * into the domain field just works instead of failing validation. Returns null
 * for empty input. Does NOT validate; callers still run the domain regex. */
export function normalizeCustomDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let d = input.trim().toLowerCase()
  if (!d) return null
  d = d.replace(/^https?:\/\//, '')   // protocol
  d = d.replace(/^www\./, '')          // apex alias
  d = d.replace(/[/?#].*$/, '')        // path / query / fragment
  d = d.replace(/\.+$/, '')            // trailing dots
  return d || null
}

/** Best-effort coercion of arbitrary text (including a pasted URL) into a valid
 * tenant slug: lowercase, drop protocol/www, keep only a-z0-9, collapse runs of
 * other chars to single hyphens, trim hyphens, cap at 40. Used for on-blur
 * cleanup in the UI so the user gets a usable value instead of a raw pattern
 * error. Returns '' when nothing usable remains. */
export function slugifyTenantInput(input: unknown): string {
  if (typeof input !== 'string') return ''
  let s = input.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '')
  s = s.replace(/[/?#].*$/, '')        // drop path so the TLD dot doesn't survive
  s = s.replace(/[^a-z0-9]+/g, '-')    // non-alphanumerics -> hyphen
  s = s.replace(/^-+|-+$/g, '')        // trim hyphens
  return s.slice(0, 40).replace(/-+$/g, '')
}
