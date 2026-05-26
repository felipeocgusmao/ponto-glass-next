const CACHE = 'pontoglass-v3'
const STATIC = ['/login']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/ponto' || url.pathname === '/admin' || url.pathname === '/kiosk') return

  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok || res.type === 'opaque') {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      })
      .catch(() => caches.match(request).then(r => r ?? fetch(request)))
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() } catch { payload = { title: 'PontoGlass', body: e.data.text() } }
  e.waitUntil(
    self.registration.showNotification(payload.title ?? 'PontoGlass', {
      body: payload.body ?? '',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: payload.tag ?? 'pontoglass',
      data: payload.url ?? '/ponto',
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data ?? '/ponto'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const target = list.find(c => c.url.includes(url)) || list[0]
      if (target) {
        target.focus()
        // Only navigate if not already on the target and the browser supports it (iOS Safari may not).
        if (!target.url.includes(url) && 'navigate' in target) return target.navigate(url).catch(() => {})
        return
      }
      return clients.openWindow(url)
    })
  )
})
