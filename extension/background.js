// Service worker: brokers geolocation through an offscreen document.
//
// navigator.geolocation isn't available in a service worker, and using it
// straight from the popup is fragile (the popup can close mid-request). An
// offscreen document is the supported MV3 way to reach navigator.geolocation
// from the background. Only one offscreen document may exist at a time, so we
// reuse it and close it when done.

const OFFSCREEN_URL = 'offscreen.html'

async function hasOffscreenDocument() {
  try {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
    return contexts.length > 0
  } catch {
    // getContexts is unavailable on older Chrome; fall through and let
    // createDocument throw if one already exists (handled below).
    return false
  }
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['GEOLOCATION'],
      justification: 'Obter a localização para validar a batida de ponto (geofencing).',
    })
  } catch (err) {
    // A concurrent caller may have created it first — ignore the "single
    // offscreen document" race and only rethrow anything unexpected.
    if (!String(err?.message || err).includes('Only a single offscreen')) throw err
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'GET_GEOLOCATION') return
  ;(async () => {
    try {
      await ensureOffscreenDocument()
      const res = await chrome.runtime.sendMessage({
        type: 'OFFSCREEN_GET_GEOLOCATION',
        timeout: msg.timeout ?? 8000,
      })
      sendResponse(res ?? { ok: false, error: 'no-response' })
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) })
    } finally {
      try { await chrome.offscreen.closeDocument() } catch { /* already closed */ }
    }
  })()
  return true // keep the message channel open for the async sendResponse
})
