export type QueuedPunch = { id: string; type: string; queuedAt: string }

const KEY = 'pg.punch_queue'

export function getQueue(): QueuedPunch[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function saveQueue(q: QueuedPunch[]) {
  localStorage.setItem(KEY, JSON.stringify(q))
}

export function enqueue(type: string): QueuedPunch {
  const entry: QueuedPunch = { id: crypto.randomUUID(), type, queuedAt: new Date().toISOString() }
  saveQueue([...getQueue(), entry])
  return entry
}

export function dequeue(id: string) {
  saveQueue(getQueue().filter(p => p.id !== id))
}

// Statuses where retrying later can succeed: auth expired (re-login), rate
// limit, or a server/network hiccup. Any other 4xx is a permanent rejection —
// keeping the punch would retry it forever on every reconnect.
function isTransient(status: number): boolean {
  return status === 401 || status === 408 || status === 429 || status >= 500
}

export async function flushQueue(): Promise<{ synced: number; failed: number; dropped: number }> {
  const q = getQueue()
  if (!q.length) return { synced: 0, failed: 0, dropped: 0 }
  let synced = 0, failed = 0, dropped = 0
  for (const punch of q) {
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // queuedAt: the wall-clock when the punch was made offline, so the
        // server can file it under the real time instead of the sync time.
        body: JSON.stringify({ type: punch.type, queuedAt: punch.queuedAt }),
      })
      if (res.ok) { dequeue(punch.id); synced++ }
      // Stop on transient failures so the remaining punches keep their order
      // (inserting punch N+1 before punch N would corrupt the day's sequence).
      else if (isTransient(res.status)) { failed++; break }
      else { dequeue(punch.id); dropped++ }
    } catch { failed++; break }
  }
  return { synced, failed, dropped }
}
