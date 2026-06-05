// Runtime detection and thin bridges for Capacitor native APIs.
// All functions are safe to call on the web — they return false / fall back
// to browser APIs when Capacitor is not present.

/** True when running inside a Capacitor native shell (iOS or Android). */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.()
}

/** 'ios' | 'android' | 'web' */
export function nativePlatform(): 'ios' | 'android' | 'web' {
  if (!isNative()) return 'web'
  const platform = (window as unknown as { Capacitor?: { getPlatform?: () => string } })
    .Capacitor?.getPlatform?.()
  if (platform === 'ios' || platform === 'android') return platform
  return 'web'
}

// ── Geolocation ───────────────────────────────────────────────────────────────

export type GeoResult = { lat: number; lng: number } | null

/**
 * Get the device position. Uses @capacitor/geolocation on native for proper
 * iOS/Android permission dialogs; falls back to navigator.geolocation on web.
 */
export async function getPosition(timeoutMs = 8000): Promise<GeoResult> {
  if (isNative()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      await Geolocation.requestPermissions()
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeoutMs,
      })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    } catch { return null }
  }

  // Web fallback — same as the existing getGeo() helpers
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs },
    )
  })
}

// ── Push Notifications ────────────────────────────────────────────────────────

export type PushToken =
  | { kind: 'web';    subscription: PushSubscriptionJSON }
  | { kind: 'native'; token: string; platform: 'ios' | 'android' }

/**
 * Register for push notifications and return a token the server can use.
 * On native: obtains an FCM/APNs device token via @capacitor/push-notifications.
 * On web:    subscribes via the Web Push API (service worker + VAPID).
 */
export async function registerPush(vapidPublicKey: string): Promise<PushToken | null> {
  if (isNative()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const perm = await PushNotifications.requestPermissions()
      if (perm.receive !== 'granted') return null
      await PushNotifications.register()

      return new Promise(resolve => {
        // Token arrives asynchronously after register().
        PushNotifications.addListener('registration', token => {
          resolve({ kind: 'native', token: token.value, platform: nativePlatform() as 'ios' | 'android' })
        })
        PushNotifications.addListener('registrationError', () => resolve(null))
        // Timeout safety: resolve null if native never fires
        setTimeout(() => resolve(null), 10_000)
      })
    } catch { return null }
  }

  // Web Push fallback
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    })
    return { kind: 'web', subscription: sub.toJSON() }
  } catch { return null }
}
