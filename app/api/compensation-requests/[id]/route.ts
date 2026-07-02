import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { isCsrfSafe } from '@/lib/csrf'
import webpush from 'web-push'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  // web-push exige subject em forma de URL — sem o "mailto:" o setVapidDetails
  // lança no carregamento do módulo e TODA a rota passa a responder 500 (#257).
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({})) as { action?: string; note?: string }
  const { action, note } = body
  if (action !== 'approve' && action !== 'reject')
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })

  const { data: existing } = await supabase
    .from('compensation_requests')
    .select('*')
    .eq('id', params.id)
    .eq('tenant_id', user.tenant_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'pending')
    return NextResponse.json({ error: 'Already resolved' }, { status: 409 })

  const status = action === 'approve' ? 'approved' : 'rejected'
  // Claim the request atomically (only while still pending) so a double-click or two
  // concurrent admins can't both resolve it — and, once approved, can't credit twice.
  const { data, error } = await supabase
    .from('compensation_requests')
    .update({
      status,
      reviewer_id: user.id,
      reviewer_name: user.name,
      reviewer_note: note ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('tenant_id', user.tenant_id)
    .eq('status', 'pending')
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Already resolved' }, { status: 409 })

  // Approving a compensation must actually credit the hour bank — otherwise the
  // request just flips to "approved" with no effect on the balance. The bank
  // balance sums hour_bank_adjustments.minutes, so insert a positive adjustment.
  if (action === 'approve') {
    const minutes = Math.round(Number(existing.hours_requested) * 60)
    const { error: adjErr } = await supabase.from('hour_bank_adjustments').insert({
      tenant_id: user.tenant_id,
      employee_id: existing.employee_id,
      minutes,
      reason: `Compensação aprovada${existing.reason ? `: ${existing.reason}` : ''}`,
      date: existing.date,
      created_by: user.id,
    })
    if (adjErr) {
      // Roll the claim back to pending so it can be retried, rather than left
      // approved-without-credit.
      await supabase.from('compensation_requests')
        .update({ status: 'pending', reviewer_id: null, reviewer_name: null, reviewer_note: null, resolved_at: null })
        .eq('id', params.id)
        .eq('tenant_id', user.tenant_id)
      return NextResponse.json({ error: adjErr.message }, { status: 500 })
    }
  }

  await logAudit(user, `compensation_${action}` as any, null, { id: params.id })

  // Push notification to employee. Guard on the same three env vars as
  // setVapidDetails above — with a partial config, sendNotification throws
  // synchronously (after the credit was already applied).
  if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('tenant_id', user.tenant_id)
      .eq('employee_id', existing.employee_id)

    if (subs?.length) {
      const approved = action === 'approve'
      const payload = JSON.stringify({
        title: approved ? 'Compensação aprovada ✅' : 'Compensação rejeitada',
        body: approved
          ? `O seu pedido de compensação de ${existing.hours_requested}h foi aprovado.`
          : `O seu pedido de compensação foi rejeitado.${note ? ` Nota: ${note}` : ''}`,
        url: '/ponto',
        tag: `comp-${params.id}`,
      })
      await Promise.allSettled(
        subs.map(({ subscription }) =>
          webpush.sendNotification(subscription as webpush.PushSubscription, payload).catch(() => {})
        )
      )
    }
  }

  return NextResponse.json(data)
}
