import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { isCsrfSafe } from '@/lib/csrf'
import webpush from 'web-push'

if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
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
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(user, `compensation_${action}` as any, null, { id: params.id })

  // Push notification to employee
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
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
