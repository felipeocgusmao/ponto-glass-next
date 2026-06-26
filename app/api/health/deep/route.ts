import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Protected deep health check — requires X-Health-Secret: $CRON_SECRET header.
// Returns the status of all required environment variables and a live DB ping.
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-health-secret')
  if (!secret || !process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const env = {
    jwt_secret:           !!process.env.JWT_SECRET,
    cron_secret:          !!process.env.CRON_SECRET,
    supabase_url:         !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_key:         !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    vapid_public_key:     !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapid_private_key:    !!process.env.VAPID_PRIVATE_KEY,
    vapid_email:          !!process.env.VAPID_EMAIL,
  }

  let dbOk = false
  let dbLatencyMs: number | null = null
  try {
    const start = Date.now()
    const { error } = await supabase.from('employees').select('id').limit(1)
    dbLatencyMs = Date.now() - start
    dbOk = !error
  } catch { /* db unreachable */ }

  const allOk = dbOk && Object.values(env).every(Boolean)

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      env,
      db: { ok: dbOk, latencyMs: dbLatencyMs },
      ts: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  )
}
