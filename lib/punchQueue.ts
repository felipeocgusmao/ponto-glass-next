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

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const q = getQueue()
  if (!q.length) return { synced: 0, failed: 0 }
  let synced = 0, failed = 0
  for (const punch of q) {
    try {
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: punch.type }),
      })
      if (res.ok) { dequeue(punch.id); synced++ }
      else failed++
    } catch { failed++; break }
  }
  return { synced, failed }
}
