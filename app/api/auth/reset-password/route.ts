import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { supabase } from '@/lib/supabase'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { verifyPasswordResetToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  if (!(await rateLimit(`reset:${ip}`, 10, 15 * 60 * 1000)))
    return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })

  const { token, new_password } = await request.json()
  if (!token || !new_password)
    return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })

  if (new_password.length < 6 || new_password.length > 100)
    return NextResponse.json({ error: 'Senha deve ter entre 6 e 100 caracteres' }, { status: 400 })

  let payload: { sub: string; pwh?: string }
  try {
    payload = await verifyPasswordResetToken(token)
  } catch {
    return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
  }

  const { data: emp } = await supabase
    .from('employees')
    .select('password_hash')
    .eq('id', payload.sub)
    .eq('active', true)
    .single()

  if (!emp) return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })

  // Single-use enforcement: reject if the password has already changed since the link was issued.
  if (payload.pwh) {
    const current = createHash('sha256').update(emp.password_hash).digest('hex').slice(0, 16)
    if (current !== payload.pwh)
      return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
  }

  const hash = await bcrypt.hash(new_password, 10)
  const { error } = await supabase
    .from('employees')
    .update({ password_hash: hash })
    .eq('id', payload.sub)
    .eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
