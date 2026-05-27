import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabase } from '@/lib/supabase'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { createPasswordResetToken } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  if (!(await rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000)))
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' }, { status: 429 })

  const { username } = await request.json()
  if (!username?.trim())
    return NextResponse.json({ error: 'Username obrigatório' }, { status: 400 })

  // Always return success to prevent username enumeration
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, email, password_hash')
    .eq('username', String(username).trim().toLowerCase())
    .eq('active', true)
    .maybeSingle()

  if (emp?.email) {
    const fingerprint = createHash('sha256').update(emp.password_hash).digest('hex').slice(0, 16)
    const token = await createPasswordResetToken(emp.id, fingerprint)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    await sendPasswordResetEmail({
      to: emp.email,
      name: emp.name,
      resetUrl: `${appUrl}/reset-password?token=${token}`,
    })
  }

  return NextResponse.json({ ok: true })
}
