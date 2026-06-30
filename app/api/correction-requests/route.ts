import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { calcWorkDate } from '@/lib/utils'
import { isCsrfSafe } from '@/lib/csrf'
import webpush from 'web-push'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

const VALID_TYPES = ['entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe']

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const isPrivileged = ['admin', 'manager'].includes(user.role)
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  let query = supabase
    .from('correction_requests')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('created_at', { ascending: false })

  if (!isPrivileged) query = query.eq('employee_id', user.id)
  if (statusFilter) query = query.eq('status', statusFilter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const body = await request.json()
  const { type, timestamp, reason } = body

  if (!type || !VALID_TYPES.includes(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  const parsed = new Date(timestamp)
  if (!timestamp || isNaN(parsed.getTime()))
    return NextResponse.json({ error: 'Timestamp inválido' }, { status: 400 })

  const { data: emp } = await supabase.from('employees').select('name, shift_start')
    .eq('tenant_id', user.tenant_id).eq('id', user.id).single()
  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const { data, error } = await supabase.from('correction_requests').insert({
    tenant_id: user.tenant_id,
    employee_id: user.id,
    employee_name: emp.name,
    req_type: type,
    req_timestamp: parsed.toISOString(),
    req_date: calcWorkDate(parsed, emp.shift_start ?? '00:00'),
    reason: reason || null,
    status: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify admins/managers via push
  if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
      // Admins/managers in the SAME tenant only — otherwise admins from other
      // companies would receive the notification.
      const { data: privileged } = await supabase
        .from('employees')
        .select('id')
        .eq('tenant_id', user.tenant_id)
        .in('role', ['admin', 'manager'])
        .eq('active', true)
      if (privileged?.length) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('subscription')
          .eq('tenant_id', user.tenant_id)
          .in('employee_id', privileged.map(e => e.id))
        const payload = JSON.stringify({
          title: '📋 Correção pendente',
          body: `${emp.name} solicitou uma correção de ponto.`,
          tag: 'correction-pending',
          url: '/admin',
        })
        for (const s of subs ?? []) {
          if (s.subscription)
            await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload).catch(() => {})
        }
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json(data, { status: 201 })
}
