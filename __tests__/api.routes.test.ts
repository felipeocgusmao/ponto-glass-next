import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/headers before importing any route
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@/lib/apiAuth', () => ({
  verifyApiAuth: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/punchValidation', () => ({
  isValidPunchType: vi.fn((t: string) => ['entrada','saída','inicio_almoco','fim_almoco','pausa_cafe','retorno_cafe'].includes(t)),
  validateGeofence: vi.fn(() => ({ ok: true })),
  isDuplicatePunch: vi.fn(() => false),
  resolvePunchTimestamp: vi.fn((_q: unknown, now: Date) => now),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
}))

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }))

import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { NextRequest } from 'next/server'

const mockCookies = cookies as ReturnType<typeof vi.fn>
const mockVerify = verifyApiAuth as ReturnType<typeof vi.fn>

function makeReq(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL(url, 'http://localhost'), init)
}

// ─── /api/punch ───────────────────────────────────────────────────────────────

describe('POST /api/punch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no cookie', async () => {
    mockCookies.mockReturnValue({ get: () => undefined })
    const { POST } = await import('@/app/api/punch/route')
    const res = await POST(makeReq('http://localhost/api/punch', {
      method: 'POST',
      body: JSON.stringify({ type: 'entrada' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is invalid', async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: 'bad-token' }) })
    mockVerify.mockRejectedValue(new Error('Invalid token'))
    const { POST } = await import('@/app/api/punch/route')
    const res = await POST(makeReq('http://localhost/api/punch', {
      method: 'POST',
      body: JSON.stringify({ type: 'entrada' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid punch type', async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: 'valid-token' }) })
    mockVerify.mockResolvedValue({ id: 'emp1', name: 'Test', role: 'employee', tenant_id: 't1', super_admin: false })
    const { POST } = await import('@/app/api/punch/route')
    const res = await POST(makeReq('http://localhost/api/punch', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid_type' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 403 when employee tries to punch on behalf of another', async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: 'valid-token' }) })
    mockVerify.mockResolvedValue({ id: 'emp1', name: 'Test', role: 'employee', tenant_id: 't1', super_admin: false })
    const { POST } = await import('@/app/api/punch/route')
    const res = await POST(makeReq('http://localhost/api/punch', {
      method: 'POST',
      body: JSON.stringify({ type: 'entrada', employeeId: 'emp2' }),
    }))
    expect(res.status).toBe(403)
  })
})

// ─── GET /api/employees ───────────────────────────────────────────────────────

describe('GET /api/employees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 without a token', async () => {
    mockCookies.mockReturnValue({ get: () => undefined })
    const { GET } = await import('@/app/api/employees/route')
    const res = await GET(makeReq('http://localhost/api/employees'))
    expect(res.status).toBe(403)
  })

  it('returns 403 for employee role', async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: 'emp-token' }) })
    mockVerify.mockResolvedValue({ id: 'emp1', name: 'Test', role: 'employee', tenant_id: 't1', super_admin: false })
    const { GET } = await import('@/app/api/employees/route')
    const res = await GET(makeReq('http://localhost/api/employees'))
    expect(res.status).toBe(403)
  })
})

// ─── GET /api/correction-requests ────────────────────────────────────────────

describe('GET /api/correction-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without a token', async () => {
    mockCookies.mockReturnValue({ get: () => undefined })
    const { GET } = await import('@/app/api/correction-requests/route')
    const res = await GET(makeReq('http://localhost/api/correction-requests'))
    expect(res.status).toBe(401)
  })

  it('returns 401 for invalid token', async () => {
    mockCookies.mockReturnValue({ get: () => ({ value: 'bad-token' }) })
    mockVerify.mockRejectedValue(new Error('Expired'))
    const { GET } = await import('@/app/api/correction-requests/route')
    const res = await GET(makeReq('http://localhost/api/correction-requests'))
    expect(res.status).toBe(401)
  })
})
