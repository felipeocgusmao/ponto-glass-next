import { describe, it, expect, vi, beforeEach } from 'vitest'

const DEFAULT = '00000000-0000-0000-0000-000000000001'

const SUPABASE_NOOP = {
  supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) },
}

describe('isValidTenantSlug', () => {
  beforeEach(() => { vi.resetModules() })

  it('mirrors the DB CHECK constraint', async () => {
    vi.doMock('../lib/supabase', () => SUPABASE_NOOP)
    const { isValidTenantSlug } = await import('../lib/tenant')

    expect(isValidTenantSlug('empresa-a')).toBe(true)
    expect(isValidTenantSlug('a1')).toBe(true)
    expect(isValidTenantSlug('x'.repeat(40))).toBe(true)

    expect(isValidTenantSlug('a')).toBe(false)              // too short
    expect(isValidTenantSlug('x'.repeat(41))).toBe(false)   // too long
    expect(isValidTenantSlug('Empresa')).toBe(false)        // uppercase
    expect(isValidTenantSlug('-empresa')).toBe(false)       // leading hyphen
    expect(isValidTenantSlug('empresa-')).toBe(false)       // trailing hyphen
    expect(isValidTenantSlug('em--presa')).toBe(false)      // double hyphen
    expect(isValidTenantSlug('a.b')).toBe(false)            // dot
    expect(isValidTenantSlug('www')).toBe(false)            // reserved (apex alias)
    expect(isValidTenantSlug(42)).toBe(false)
    expect(isValidTenantSlug(null)).toBe(false)
  })
})

describe('activeTenantIds', () => {
  beforeEach(() => { vi.resetModules() })

  it('returns every active tenant id', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: () => ({ select: () => ({ eq: async () => ({ data: [{ id: 't1' }, { id: 't2' }], error: null }) }) }),
      },
    }))
    const { activeTenantIds } = await import('../lib/tenant')
    expect(await activeTenantIds()).toEqual(['t1', 't2'])
  })

  it('falls back to the default tenant when the lookup fails (pre-migration DBs)', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'relation "tenants" does not exist' } }) }) }),
      },
    }))
    const { activeTenantIds } = await import('../lib/tenant')
    expect(await activeTenantIds()).toEqual([DEFAULT])
  })

  it('falls back to the default tenant when the table is empty', async () => {
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
      },
    }))
    const { activeTenantIds } = await import('../lib/tenant')
    expect(await activeTenantIds()).toEqual([DEFAULT])
  })
})

describe('verifyApiAuth — super_admin flag', () => {
  beforeEach(() => { vi.resetModules() })

  it('propagates super_admin=true from the database', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { active: true, sessions_valid_from: null, tenant_id: 'tenant-A', super_admin: true },
      error: null,
    })
    vi.doMock('../lib/supabase', () => ({
      supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) },
    }))
    vi.doMock('../lib/auth', () => ({
      verifyJWTWithMeta: async () => ({
        user: { id: 'u1', name: 'Root', username: 'root', role: 'admin', tenant_id: 'tenant-A' },
        iat: 1_700_000_000,
      }),
    }))
    const { verifyApiAuth } = await import('../lib/apiAuth')
    const user = await verifyApiAuth('token')
    expect(user.super_admin).toBe(true)
  })

  it('retries without super_admin when the column is missing, and reports false', async () => {
    // Pre-phase-5 DBs: the extended select errors, the basic one succeeds —
    // revocation and tenant scoping keep working, super_admin is just false.
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'column employees.super_admin does not exist' } })
      .mockResolvedValueOnce({ data: { active: true, sessions_valid_from: null, tenant_id: 'tenant-A' }, error: null })
    vi.doMock('../lib/supabase', () => ({
      supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) },
    }))
    vi.doMock('../lib/auth', () => ({
      verifyJWTWithMeta: async () => ({
        user: { id: 'u1', name: 'Alice', username: 'a', role: 'admin', tenant_id: 'tenant-A' },
        iat: 1_700_000_000,
      }),
    }))
    const { verifyApiAuth } = await import('../lib/apiAuth')
    const user = await verifyApiAuth('token')
    expect(maybeSingle).toHaveBeenCalledTimes(2)
    expect(user.super_admin).toBe(false)
    expect(user.tenant_id).toBe('tenant-A')
  })
})
