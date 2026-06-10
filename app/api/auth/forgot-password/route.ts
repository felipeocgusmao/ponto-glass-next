import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabase } from '@/lib/supabase'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { createPasswordResetToken } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'
import { resolveLoginTenant, requestHost } from '@/lib/tenant'

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  if (!(await rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)))
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' }, { status: 429 })

  const { username } = await request.json()
  if (!username?.trim())
    return NextResponse.json({ error: 'Username obrigatório' }, { status: 400 })

  // Resolve the tenant the same way login does so the username lookup matches
  // the tenant-scoped uniqueness constraint. Null = unknown tenant subdomain;
  // answer success without sending anything (no enumeration).
  const tenantId = await resolveLoginTenant(request)
  if (!tenantId) return NextResponse.json({ ok: true })

  // Always return success to prevent username enumeration
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, email, password_hash')
    .eq('tenant_id', tenantId)
    .eq('username', String(username).trim().toLowerCase())
    .eq('active', true)
    .maybeSingle()

  if (emp?.email) {
    const fingerprint = createHash('sha256').update(emp.password_hash).digest('hex')
    const token = await createPasswordResetToken(emp.id, fingerprint)
    // Build the link on the host the user is visiting, so each tenant gets a
    // reset link on its own (sub)domain. Fall back to the configured app URL
    // (local dev, tools posting without a Host header).
    const host = requestHost(request)
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    const appUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? '')
    await sendPasswordResetEmail({
      to: emp.email,
      name: emp.name,
      resetUrl: `${appUrl}/reset-password?token=${token}`,
    })
  }

  return NextResponse.json({ ok: true })
}
