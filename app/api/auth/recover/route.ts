import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { timingSafeEqual } from 'crypto'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'

function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!rateLimit(`recover:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429 }
    )
  }

  const secret = process.env.RECOVERY_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Recuperação não configurada. Defina RECOVERY_SECRET no ambiente.' },
      { status: 503 }
    )
  }

  const { username, recovery_secret, new_password } = await request.json()

  if (!username || !recovery_secret || !new_password) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  if (!secretsMatch(String(recovery_secret), secret)) {
    return NextResponse.json({ error: 'Chave de recuperação inválida' }, { status: 401 })
  }

  if (new_password.length < 6 || new_password.length > 100) {
    return NextResponse.json({ error: 'Senha deve ter entre 6 e 100 caracteres' }, { status: 400 })
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('id, role')
    .eq('username', String(username).trim().toLowerCase())
    .eq('active', true)
    .single()

  if (!employee) {
    // Don't reveal whether the username exists (avoid enumeration by anyone holding the
    // secret). A legitimate operator who mistyped will simply fail to log in afterwards.
    return NextResponse.json({ success: true })
  }

  // Admin accounts cannot be reset via the shared RECOVERY_SECRET (as documented in
  // .env.example) — they must use the per-user e-mail reset link — so a leaked secret
  // can never take over an administrator.
  if (employee.role === 'admin') {
    return NextResponse.json(
      { error: 'Contas de administrador não podem ser recuperadas por esta via. Use a recuperação por e-mail.' },
      { status: 403 }
    )
  }

  const hash = await bcrypt.hash(new_password, 10)
  const { error } = await supabase
    .from('employees')
    .update({ password_hash: hash })
    .eq('id', employee.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
