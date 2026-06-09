import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getQueue, enqueue, flushQueue } from '../lib/punchQueue'

// flushQueue runs in the browser; emulate the two globals it touches.
function stubLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  })
}

function jsonResponse(status: number) {
  return { ok: status >= 200 && status < 300, status } as Response
}

describe('punchQueue', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    stubLocalStorage()
  })

  it('enqueue stores the punch with its original wall-clock', () => {
    const before = Date.now()
    const entry = enqueue('entrada')
    expect(getQueue()).toHaveLength(1)
    expect(entry.type).toBe('entrada')
    const queuedAt = new Date(entry.queuedAt).getTime()
    expect(queuedAt).toBeGreaterThanOrEqual(before)
    expect(queuedAt).toBeLessThanOrEqual(Date.now())
  })

  it('getQueue survives corrupted storage', () => {
    localStorage.setItem('pg.punch_queue', '{nope')
    expect(getQueue()).toEqual([])
  })

  it('flushQueue sends queuedAt so the server files the punch under the real time', async () => {
    const entry = enqueue('entrada')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200))
    vi.stubGlobal('fetch', fetchMock)

    const result = await flushQueue()

    expect(result).toEqual({ synced: 1, failed: 0, dropped: 0 })
    expect(getQueue()).toHaveLength(0)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({ type: 'entrada', queuedAt: entry.queuedAt })
  })

  it('flushQueue drops punches the server permanently rejects (4xx)', async () => {
    enqueue('entrada')
    enqueue('saída')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(409)) // duplicate → never going to succeed
      .mockResolvedValueOnce(jsonResponse(200))
    vi.stubGlobal('fetch', fetchMock)

    const result = await flushQueue()

    expect(result).toEqual({ synced: 1, failed: 0, dropped: 1 })
    expect(getQueue()).toHaveLength(0)
  })

  it('flushQueue keeps the queue and stops on transient failures (5xx)', async () => {
    enqueue('entrada')
    enqueue('saída')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500))
    vi.stubGlobal('fetch', fetchMock)

    const result = await flushQueue()

    expect(result).toEqual({ synced: 0, failed: 1, dropped: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1) // stopped: punch order must be preserved
    expect(getQueue()).toHaveLength(2)
  })

  it('flushQueue treats expired auth (401) as transient so punches survive a re-login', async () => {
    enqueue('entrada')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401)))

    const result = await flushQueue()

    expect(result).toEqual({ synced: 0, failed: 1, dropped: 0 })
    expect(getQueue()).toHaveLength(1)
  })

  it('flushQueue keeps the queue when the network drops mid-flush', async () => {
    enqueue('entrada')
    enqueue('saída')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200))
      .mockRejectedValueOnce(new TypeError('network down'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await flushQueue()

    expect(result).toEqual({ synced: 1, failed: 1, dropped: 0 })
    expect(getQueue()).toHaveLength(1) // only the unsent punch remains
  })
})
