import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'

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

  if (recovery_secret !== secret) {
    return NextResponse.json({ error: 'Chave de recuperação inválida' }, { status: 401 })
  }

  if (new_password.length < 6 || new_password.length > 100) {
    return NextResponse.json({ error: 'Senha deve ter entre 6 e 100 caracteres' }, { status: 400 })
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('username', String(username).trim())
    .eq('active', true)
    .single()

  if (!employee) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  const hash = await bcrypt.hash(new_password, 10)
  const { error } = await supabase
    .from('employees')
    .update({ password_hash: hash })
    .eq('id', employee.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
