import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'

// #292 — last-run timestamp per cron, sourced from the 'cron_run' heartbeat
// each cron route writes (lib/cronHealth.ts) after passing its own auth/
// off-hour gate. Rows are inserted newest-first per invocation, so the first
// match per cron name in a DESC scan is already the most recent.
export async function GET() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabase
    .from('audit_logs')
    .select('details, created_at')
    .eq('tenant_id', user.tenant_id)
    .eq('action', 'cron_run')
    .order('created_at', { ascending: false })
    .limit(500)

  const lastRun: Record<string, string> = {}
  for (const row of (data ?? []) as { details: { cron?: string } | null; created_at: string }[]) {
    const cron = row.details?.cron
    if (cron && !(cron in lastRun)) lastRun[cron] = row.created_at
  }

  return NextResponse.json(lastRun, {
    headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=300' },
  })
}
