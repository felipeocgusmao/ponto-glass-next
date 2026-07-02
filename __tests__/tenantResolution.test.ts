import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Host → tenant resolution (phase 4 of issue #6 / issue #5).
//
// lib/tenant reads NEXT_PUBLIC_TENANT_ROOT_DOMAIN at module load and imports
// lib/supabase (whose client is built from env at load), so every test stubs
// the env + supabase first and imports the module fresh.

const DEFAULT = '00000000-0000-0000-0000-000000000001'

// Mock the two lookups resolveLoginTenant performs. `domain`/`slug` are the
// tenant ids to return for the respective lookup (null = no match).
function mockSupabase({ domain = null, slug = null }: { domain?: string | null; slug?: string | null }) {
  vi.doMock('../lib/supabase', () => ({
    supabase: {
      from: () => ({
        select: () => ({
          eq: (col: string) => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: (col === 'domain' ? domain : slug) ? { id: col === 'domain' ? domain : slug } : null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    },
  }))
}

function reqWithHost(host?: string) {
  const headers = new Headers()
  if (host) headers.set('host', host)
  return { headers } as never
}

async function resolve(host: string | undefined, mocks: { domain?: string | null; slug?: string | null } = {}) {
  mockSupabase(mocks)
  const { resolveLoginTenant } = await import('../lib/tenant')
  return resolveLoginTenant(reqWithHost(host))
}

describe('resolveLoginTenant — host routing', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_TENANT_ROOT_DOMAIN', 'pontoglass.app')
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('matches a registered custom domain first', async () => {
    expect(await resolve('ponto.empresa.com', { domain: 'tenant-custom' })).toBe('tenant-custom')
  })

  it('resolves a slug subdomain under the root domain', async () => {
    expect(await resolve('empresa-a.pontoglass.app', { slug: 'tenant-a' })).toBe('tenant-a')
  })

  it('a custom domain registration beats the slug path even under the root', async () => {
    // e.g. someone registered "empresa-a.pontoglass.app" as a custom domain.
    expect(await resolve('empresa-a.pontoglass.app', { domain: 'tenant-via-domain', slug: 'tenant-a' }))
      .toBe('tenant-via-domain')
  })

  it('refuses an unknown slug under the root domain (null, not default)', async () => {
    // Authenticating against the default tenant while the URL claims another
    // company would be a dangerous mismatch — the caller must show an error.
    expect(await resolve('nao-existe.pontoglass.app', {})).toBeNull()
  })

  it('apex and www serve the default tenant', async () => {
    expect(await resolve('pontoglass.app', {})).toBe(DEFAULT)
    expect(await resolve('www.pontoglass.app', {})).toBe(DEFAULT)
  })

  it('nested subdomains are not tenant slugs', async () => {
    expect(await resolve('a.b.pontoglass.app', {})).toBe(DEFAULT)
  })

  it('hosts outside the root domain fall back to the default tenant', async () => {
    expect(await resolve('localhost', {})).toBe(DEFAULT)
    expect(await resolve('ponto-glass-next-git-preview.vercel.app', {})).toBe(DEFAULT)
  })

  it('strips port and lowercases the host', async () => {
    expect(await resolve('EMPRESA-A.pontoglass.app:3000', { slug: 'tenant-a' })).toBe('tenant-a')
  })
})

describe('resolveLoginTenant — explicit tenant slug (/login?tenant=)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_TENANT_ROOT_DOMAIN', '')
  })
  afterEach(() => { vi.unstubAllEnvs() })

  async function resolveSlug(slug: unknown, mocks: { domain?: string | null; slug?: string | null } = {}) {
    mockSupabase(mocks)
    const { resolveLoginTenant } = await import('../lib/tenant')
    return resolveLoginTenant(reqWithHost('ponto-glass-next.vercel.app'), slug)
  }

  it('resolves an active tenant by explicit slug, beating host resolution', async () => {
    expect(await resolveSlug('demo', { slug: 'tenant-demo' })).toBe('tenant-demo')
  })

  it('refuses an unknown explicit slug (null, not default)', async () => {
    expect(await resolveSlug('nao-existe', {})).toBeNull()
  })

  it('ignores malformed slugs and falls back to host resolution', async () => {
    expect(await resolveSlug('NOT a slug!', {})).toBe(DEFAULT)
    expect(await resolveSlug({ evil: true }, {})).toBe(DEFAULT)
    expect(await resolveSlug(undefined, {})).toBe(DEFAULT)
  })

  it("the reserved slug 'www' is never looked up", async () => {
    expect(await resolveSlug('www', { slug: 'should-not-match' })).toBe(DEFAULT)
  })
})

describe('resolveLoginTenant — subdomain routing disabled (no root domain)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_TENANT_ROOT_DOMAIN', '')
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('any host resolves to the default tenant (single-tenant behaviour)', async () => {
    expect(await resolve('whatever.example.com', {})).toBe(DEFAULT)
  })

  it('custom domains still work without a root domain configured', async () => {
    expect(await resolve('ponto.empresa.com', { domain: 'tenant-custom' })).toBe('tenant-custom')
  })
})
