import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import webpush from 'web-push'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, note } = await request.json()
  if (!['approve', 'reject'].includes(action))
    return NextResponse.json({ error: 'Ação inválida. Use approve ou reject.' }, { status: 400 })

  const { data: cr } = await supabase
    .from('correction_requests')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!cr) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  if (cr.status !== 'pending') return NextResponse.json({ error: 'Pedido já resolvido' }, { status: 409 })

  if (action === 'approve') {
    const { error: recErr } = await supabase.from('records').insert({
      employee_id: cr.employee_id,
      employee_name: cr.employee_name,
      type: cr.req_type,
      timestamp: cr.req_timestamp,
      date: cr.req_date,
    })
    if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 })

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_name: user.name,
      action: 'correction_approved',
      target_id: cr.employee_id,
      target_name: cr.employee_name,
      details: { req_type: cr.req_type, req_timestamp: cr.req_timestamp, reason: cr.reason },
    })
  } else {
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      actor_name: user.name,
      action: 'correction_rejected',
      target_id: cr.employee_id,
      target_name: cr.employee_name,
      details: { req_type: cr.req_type, req_timestamp: cr.req_timestamp, reason: cr.reason, note },
    })
  }

  const { data, error } = await supabase
    .from('correction_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewer_id: user.id,
      reviewer_name: user.name,
      reviewer_note: note || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send push notification to the employee if they have a subscription
  if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
      const { data: sub } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('employee_id', cr.employee_id)
        .maybeSingle()

      if (sub?.subscription) {
        const approved = action === 'approve'
        const payload = JSON.stringify({
          title: approved ? 'Correcção aprovada ✓' : 'Correcção rejeitada',
          body: approved
            ? `A sua correcção de ponto foi aprovada por ${user.name}.`
            : `A sua correcção de ponto foi rejeitada.${note ? ` Motivo: ${note}` : ''}`,
          tag: 'correction',
          url: '/ponto',
        })
        await webpush.sendNotification(sub.subscription as webpush.PushSubscription, payload)
      }
    } catch { /* push failure is non-fatal */ }
  }

  return NextResponse.json(data)
}
