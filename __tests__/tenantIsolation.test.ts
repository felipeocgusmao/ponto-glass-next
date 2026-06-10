import { describe, it, expect, vi, beforeEach } from 'vitest'

// lib/tenant (and everything that imports it) pulls lib/supabase, whose client
// is created at module load from env vars — so every import here is dynamic,
// behind a vi.doMock of the supabase module.
const SUPABASE_NOOP = {
  supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) },
}

describe('multi-tenancy — tenant constants', () => {
  beforeEach(() => { vi.resetModules() })

  it('exposes a deterministic default tenant id', async () => {
    // The schema migration hard-codes this same value; if either side moves,
    // every existing row stops resolving and the prod app breaks. Treat the
    // constant as load-bearing.
    vi.doMock('../lib/supabase', () => SUPABASE_NOOP)
    const { DEFAULT_TENANT_ID } = await import('../lib/tenant')
    expect(DEFAULT_TENANT_ID).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('resolveLoginTenant returns the default when the request has no host', async () => {
    vi.doMock('../lib/supabase', () => SUPABASE_NOOP)
    const { DEFAULT_TENANT_ID, resolveLoginTenant } = await import('../lib/tenant')
    const req = { headers: new Headers() } as never
    expect(await resolveLoginTenant(req)).toBe(DEFAULT_TENANT_ID)
  })
})

describe('multi-tenancy — logAudit', () => {
  beforeEach(() => { vi.resetModules() })

  it('writes the actor tenant_id into the audit row', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    vi.doMock('../lib/supabase', () => ({
      supabase: { from: () => ({ insert }) },
    }))
    const { logAudit } = await import('../lib/audit')

    await logAudit(
      { id: 'u1', name: 'Alice', tenant_id: 'tenant-A' },
      'punch_create', { id: 'e1', name: 'Bob' }, { kind: 'entrada' }
    )

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0]).toMatchObject({
      tenant_id: 'tenant-A',
      actor_id: 'u1',
      actor_name: 'Alice',
      target_id: 'e1',
      target_name: 'Bob',
      action: 'punch_create',
    })
  })

  it('falls back to the default tenant when the caller did not pass one', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    vi.doMock('../lib/supabase', () => ({
      supabase: { from: () => ({ insert }) },
    }))
    const { logAudit } = await import('../lib/audit')
    const { DEFAULT_TENANT_ID } = await import('../lib/tenant')

    // Legacy callers (cron bootstrap, scripts) may not know their tenant; the
    // default is the safest landing zone — it's the only tenant that exists
    // pre-multi-tenancy and never corresponds to a real second customer.
    await logAudit({ id: 'sys', name: 'cron:test' }, 'system_action')

    expect(insert.mock.calls[0][0].tenant_id).toBe(DEFAULT_TENANT_ID)
  })
})

describe('multi-tenancy — verifyApiAuth', () => {
  beforeEach(() => { vi.resetModules() })

  it('uses the DB tenant_id, not the token claim, when both differ', async () => {
    // A forged token that claims tenant-X for a user who actually belongs to
    // tenant-A must NOT be able to read tenant-X data. The DB is source of truth.
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { active: true, sessions_valid_from: null, tenant_id: 'tenant-A' },
      error: null,
    })
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
      },
    }))
    vi.doMock('../lib/auth', () => ({
      verifyJWTWithMeta: async () => ({
        user: { id: 'u1', name: 'Mallory', username: 'm', role: 'employee', tenant_id: 'tenant-X' },
        iat: 1_700_000_000,
      }),
    }))
    const { verifyApiAuth } = await import('../lib/apiAuth')

    const user = await verifyApiAuth('any-token')
    expect(user.tenant_id).toBe('tenant-A')
  })

  it('falls back to the default tenant_id when the DB lookup fails (resilience)', async () => {
    // Pre-phase-1 databases lack the tenant_id column. Until the migration
    // runs, the resilience branch returns the JWT claim (or default), rather
    // than locking everyone out of the system.
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'column missing' } })
    vi.doMock('../lib/supabase', () => ({
      supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) },
    }))
    vi.doMock('../lib/auth', () => ({
      verifyJWTWithMeta: async () => ({
        user: { id: 'u1', name: 'Alice', username: 'a', role: 'employee' }, // no tenant_id
        iat: 1_700_000_000,
      }),
    }))
    const { verifyApiAuth } = await import('../lib/apiAuth')
    const { DEFAULT_TENANT_ID } = await import('../lib/tenant')

    const user = await verifyApiAuth('any-token')
    expect(user.tenant_id).toBe(DEFAULT_TENANT_ID)
  })

  it('rejects revoked sessions even when the DB row carries a valid tenant_id', async () => {
    // Revocation must NOT be bypassed by tenant validation succeeding.
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        active: true,
        sessions_valid_from: new Date('2026-06-09T00:00:00Z').toISOString(),
        tenant_id: 'tenant-A',
      },
      error: null,
    })
    vi.doMock('../lib/supabase', () => ({
      supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) },
    }))
    vi.doMock('../lib/auth', () => ({
      verifyJWTWithMeta: async () => ({
        user: { id: 'u1', name: 'Alice', username: 'a', role: 'employee', tenant_id: 'tenant-A' },
        iat: 1_700_000_000, // way before sessions_valid_from
      }),
    }))
    const { verifyApiAuth } = await import('../lib/apiAuth')

    await expect(verifyApiAuth('revoked-token')).rejects.toThrow(/revoked/i)
  })
})
