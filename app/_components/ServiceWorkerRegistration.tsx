'use client'

import { useEffect, useRef, useState } from 'react'

// #290 — the service worker used to call skipWaiting()+clients.claim()
// unconditionally on install, swapping the active worker under an open tab
// without any signal. The tab kept running the OLD JS/CSS until the user
// happened to fully close and reopen the app (often twice), which looked
// like a deploy just never reaching them. Now the new worker waits, this
// component notices it, and the reload only happens once the user accepts.
export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false)
  const waitingWorker = useRef<ServiceWorker | null>(null)
  const reloading = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(reg => {
      // A worker may already be sitting in 'waiting' from an update that
      // landed while this tab was in the background.
      if (reg.waiting && reg.active) {
        waitingWorker.current = reg.waiting
        setUpdateReady(true)
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          // 'installed' + an existing controller means this is an update to an
          // already-running app, not the very first install on this device.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorker.current = installing
            setUpdateReady(true)
          }
        })
      })

      // Deploys can land while the tab sits backgrounded for a long time;
      // check again whenever it becomes visible so the prompt isn't stuck
      // behind the browser's own (much slower) update polling.
      const onVisible = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) }
      document.addEventListener('visibilitychange', onVisible)
      return () => document.removeEventListener('visibilitychange', onVisible)
    }).catch(() => {})

    const onControllerChange = () => {
      if (reloading.current) return
      reloading.current = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  if (!updateReady) return null

  return (
    <div className="sw-update-banner" role="status">
      <span>Nova versão disponível</span>
      <button
        type="button"
        className="btn"
        onClick={() => waitingWorker.current?.postMessage('SKIP_WAITING')}
      >
        Atualizar
      </button>
    </div>
  )
}
