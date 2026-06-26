const CACHE = 'pontoglass-v6'
const STATIC_PRECACHE = ['/login', '/offline']

self.addEventListener('install', e => {
  e.waitUntil(
    // cache: 'reload' bypasses HTTP cache so precached shells are always fresh.
    caches.open(CACHE)
      .then(c => c.addAll(STATIC_PRECACHE.map(url => new Request(url, { cache: 'reload' }))))
      .catch(() => {}) // /offline may not exist yet — fail silently
      .then(() => self.skipWaiting())
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

  // Never intercept API calls — always go to network.
  if (url.pathname.startsWith('/api/')) return

  // Immutable static assets (hashed Next.js chunks, fonts, icons) — cache-first.
  const isImmutable = url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') || /\.(?:woff2?|ttf)$/.test(url.pathname))
  if (isImmutable) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Static assets that may change (images, icons, css not in /_next/static/) —
  // stale-while-revalidate.
  const isSameSiteStatic = url.origin === self.location.origin &&
    /\.(?:js|css|png|jpe?g|svg|ico|webp)$/.test(url.pathname)
  if (isSameSiteStatic) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(request).then(cached => {
          const fresh = fetch(request).then(res => {
            if (res.ok || res.type === 'opaque') cache.put(request, res.clone())
            return res
          }).catch(() => cached ?? new Response('', { status: 503 }))
          return cached ?? fresh
        })
      )
    )
    return
  }

  // App shell pages — network-first with stale-while-revalidate fallback.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
        }
        return res
      }).catch(() =>
        caches.match(request).then(cached =>
          cached ?? caches.match('/offline').then(offline =>
            offline ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          )
        )
      )
    )
  }
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

// Background Sync: when device reconnects, notify open clients so they flush
// the localStorage punch queue (SW can't read localStorage directly).
self.addEventListener('sync', e => {
  if (e.tag !== 'punch-queue') return
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(cs => cs.forEach(c => c.postMessage({ type: 'SYNC_PUNCH_QUEUE' })))
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
        if (!target.url.includes(url) && 'navigate' in target) return target.navigate(url).catch(() => {})
        return
      }
      return clients.openWindow(url)
    })
  )
})
