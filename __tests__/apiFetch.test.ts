import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// apiFetch is a thin wrapper around fetch that intercepts 401 responses.
// In a node environment window is undefined so the redirect branch is skipped,
// but we can still verify: pass-through for 2xx, and that 401 does not throw.

// We stub the global fetch before importing to keep the module system happy.
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Dynamic import ensures the stub is in place before the module loads.
const { apiFetch } = await import('../lib/apiFetch')

describe('apiFetch', () => {
  beforeEach(() => fetchMock.mockReset())
  afterEach(() => vi.restoreAllMocks())

  it('returns the response for a 200 OK', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const res = await apiFetch('/api/punch', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith('/api/punch', { method: 'POST' })
  })

  it('forwards arbitrary init options to fetch', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    const init = { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
    await apiFetch('/api/resource/1', init)
    expect(fetchMock).toHaveBeenCalledWith('/api/resource/1', init)
  })

  it('still returns the response on 401 (redirect handled by browser)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
    // In node environment window is undefined so no redirect happens — the
    // response is returned as-is so callers can decide what to do.
    const res = await apiFetch('/api/me')
    expect(res.status).toBe(401)
  })

  it('does not swallow non-401 error statuses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    const res = await apiFetch('/api/missing')
    expect(res.status).toBe(404)
  })

  it('propagates fetch network errors', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(apiFetch('/api/punch')).rejects.toThrow('Failed to fetch')
  })
})
