import crypto from 'crypto'

// Fires a signed POST to PLATFORM_WEBHOOK_URL when platform events occur
// (tenant created, deactivated, reactivated, plan changed, trial set).
// The signature header matches the per-tenant webhook format so receivers
// can reuse the same validation logic.

export async function firePlatformWebhook(
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = process.env.PLATFORM_WEBHOOK_URL
  const secret = process.env.PLATFORM_WEBHOOK_SECRET
  if (!url) return // webhook not configured — silent skip

  const body = JSON.stringify({ event, ...payload, fired_at: new Date().toISOString() })
  const signature = secret
    ? 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
    : undefined

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'X-PontoGlass-Signature': signature } : {}),
      },
      body,
      signal: AbortSignal.timeout(5000),
    })
  } catch { /* webhook delivery failure must never break the main flow */ }
}
