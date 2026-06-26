import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const START_TIME = Date.now()

export async function GET() {
  const dbStart = Date.now()
  let db: 'up' | 'down' = 'up'
  let dbLatencyMs: number | null = null
  try {
    const { error } = await supabase.from('employees').select('id').limit(1)
    dbLatencyMs = Date.now() - dbStart
    if (error) db = 'down'
  } catch {
    db = 'down'
  }

  const ok = db === 'up'
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000)

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '0.3.0',
      uptime: uptimeSeconds,
      services: {
        db: { status: db, latencyMs: dbLatencyMs },
      },
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  )
}
