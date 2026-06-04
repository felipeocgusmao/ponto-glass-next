import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { JWTUser } from '@/lib/types'

let cookieToken: string | null
let currentUser: JWTUser
let fromMock: ReturnType<typeof vi.fn>

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => name === 'ponto_token' && cookieToken ? { value: cookieToken } : undefined,
  }),
}))

vi.mock('@/lib/apiAuth', () => ({
  verifyApiAuth: vi.fn(async () => currentUser),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => fromMock(table) },
}))

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn(async () => true),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(async () => undefined),
}))

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async () => undefined),
  },
}))

function jsonRequest(path: string, body: unknown, method = 'POST') {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function queryDouble(result: unknown) {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'lt', 'in', 'order', 'limit', 'contains']) {
    query[method] = vi.fn(() => query)
  }
  query.single = vi.fn(async () => result)
  query.maybeSingle = vi.fn(async () => result)
  query.insert = vi.fn(() => query)
  query.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return query
}

beforeEach(() => {
  cookieToken = 'token'
  currentUser = { id: 'emp-1', name: 'Ana Silva', username: 'ana', role: 'employee' }
  fromMock = vi.fn(() => queryDouble({ data: null, error: null }))
})

describe('/api/punch', () => {
  it('rejects requests without an auth cookie', async () => {
    cookieToken = null
    const { POST } = await import('@/app/api/punch/route')

    const res = await POST(jsonRequest('/api/punch', { type: 'entrada' }) as never)

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('creates a punch for the authenticated employee', async () => {
    const created = {
      id: 'rec-1',
      employee_id: 'emp-1',
      employee_name: 'Ana Silva',
      type: 'entrada',
      timestamp: '2026-06-04T09:00:00.000Z',
      date: '2026-06-04',
    }
    const recordsQuery = queryDouble({ data: null, error: null })
    recordsQuery.insert = vi.fn(() => queryDouble({ data: created, error: null }))

    fromMock = vi.fn((table: string) => {
      if (table === 'employees') {
        return queryDouble({
          data: { id: 'emp-1', name: 'Ana Silva', shift_start: '00:00', geo_mode: 'disabled' },
          error: null,
        })
      }
      if (table === 'records') return recordsQuery
      return queryDouble({ data: null, error: null })
    })

    const { POST } = await import('@/app/api/punch/route')
    const res = await POST(jsonRequest('/api/punch', { type: 'entrada' }) as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(created)
    expect(recordsQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      employee_id: 'emp-1',
      employee_name: 'Ana Silva',
      type: 'entrada',
    }))
  })
})

describe('/api/hour-bank', () => {
  it('prevents an employee from reading another employee balance', async () => {
    const { GET } = await import('@/app/api/hour-bank/route')

    const res = await GET(new Request('http://localhost/api/hour-bank?employeeId=emp-2') as never)

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Forbidden' })
  })

  it('allows an admin to create a manual adjustment', async () => {
    currentUser = { id: 'admin-1', name: 'Admin', username: 'admin', role: 'admin' }
    const adjustment = { id: 'adj-1', employee_id: 'emp-1', minutes: 30, reason: 'Ajuste' }
    const insertQuery = queryDouble({ data: adjustment, error: null })
    const adjustmentsQuery = queryDouble({ data: null, error: null })
    adjustmentsQuery.insert = vi.fn(() => insertQuery)

    fromMock = vi.fn((table: string) => {
      if (table === 'employees') return queryDouble({ data: { name: 'Ana Silva' }, error: null })
      if (table === 'hour_bank_adjustments') return adjustmentsQuery
      return queryDouble({ data: null, error: null })
    })

    const { POST } = await import('@/app/api/hour-bank/route')
    const res = await POST(jsonRequest('/api/hour-bank', {
      employeeId: 'emp-1',
      minutes: '30',
      reason: 'Ajuste',
      date: '2026-06-04',
    }) as never)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(adjustment)
    expect(adjustmentsQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      employee_id: 'emp-1',
      minutes: 30,
      reason: 'Ajuste',
      created_by: 'admin-1',
    }))
  })
})

describe('/api/correction-requests', () => {
  it('rejects invalid correction types', async () => {
    const { POST } = await import('@/app/api/correction-requests/route')

    const res = await POST(jsonRequest('/api/correction-requests', {
      type: 'ferias',
      timestamp: '2026-06-04T09:00:00.000Z',
    }) as never)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Tipo inválido' })
  })

  it('lists only the authenticated employee corrections for non-privileged users', async () => {
    const query = queryDouble({ data: [{ id: 'corr-1', employee_id: 'emp-1' }], error: null })
    fromMock = vi.fn((table: string) => {
      if (table === 'correction_requests') return query
      return queryDouble({ data: null, error: null })
    })

    const { GET } = await import('@/app/api/correction-requests/route')
    const res = await GET(new Request('http://localhost/api/correction-requests?status=pending') as never)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'corr-1', employee_id: 'emp-1' }])
    expect(query.eq).toHaveBeenCalledWith('employee_id', 'emp-1')
    expect(query.eq).toHaveBeenCalledWith('status', 'pending')
  })
})
