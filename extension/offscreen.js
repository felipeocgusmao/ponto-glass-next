// Runs inside the offscreen document, which (unlike the service worker) has a
// document and therefore access to navigator.geolocation. Replies to the
// service worker's request with { ok, lat, lng } or { ok:false, error }.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'OFFSCREEN_GET_GEOLOCATION') return
  if (!navigator.geolocation) {
    sendResponse({ ok: false, error: 'geolocation-unavailable' })
    return
  }
  navigator.geolocation.getCurrentPosition(
    pos => sendResponse({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
    err => sendResponse({ ok: false, error: err.message }),
    { timeout: msg.timeout ?? 8000, maximumAge: 60_000, enableHighAccuracy: false },
  )
  return true // async sendResponse
})
