import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  let db = 'up'
  try {
    const { error } = await supabase.from('employees').select('id').limit(1)
    if (error) db = 'down'
  } catch {
    db = 'down'
  }
  const ok = db === 'up'
  return NextResponse.json(
    { status: ok ? 'ok' : 'degraded', db, ts: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  )
}
