import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function PUT(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Token inválido' }, { status: 401 }) }

  const { currentPassword, newPassword } = await request.json()

  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })

  if (newPassword.length < 6)
    return NextResponse.json({ error: 'Nova senha: mínimo 6 caracteres' }, { status: 400 })

  const { data: emp } = await supabase
    .from('employees')
    .select('password_hash')
    .eq('id', user.id)
    .single()

  if (!emp) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const match = await bcrypt.compare(currentPassword, emp.password_hash)
  if (!match) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

  const hash = await bcrypt.hash(newPassword, 10)
  const { error } = await supabase
    .from('employees')
    .update({ password_hash: hash })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
