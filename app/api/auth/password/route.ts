import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { verifyApiAuth } from '@/lib/apiAuth'
import { createJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function PUT(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Token inválido' }, { status: 401 }) }

  const { currentPassword, newPassword } = await request.json()

  if (!currentPassword || !newPassword)
    return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })

  if (newPassword.length < 6 || newPassword.length > 100)
    return NextResponse.json({ error: 'Nova senha deve ter entre 6 e 100 caracteres' }, { status: 400 })

  const { data: emp } = await supabase
    .from('employees')
    .select('password_hash, lock_profile')
    .eq('id', user.id)
    .single()

  if (!emp) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  if (emp.lock_profile === true)
    return NextResponse.json({ error: 'Edição de perfil bloqueada pelo administrador.' }, { status: 403 })

  const match = await bcrypt.compare(currentPassword, emp.password_hash)
  if (!match) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })

  const hash = await bcrypt.hash(newPassword, 10)
  const { error } = await supabase
    .from('employees')
    .update({ password_hash: hash })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Revoke tokens issued before now (back-dated 2s so the fresh token below survives the
  // check), then re-issue so the user stays logged in with a new session instead of being
  // kicked to the login screen. Best-effort: no-op if sessions_valid_from isn't migrated yet.
  await supabase
    .from('employees')
    .update({ sessions_valid_from: new Date(Date.now() - 2000).toISOString() })
    .eq('id', user.id)

  const fresh = await createJWT({ id: user.id, name: user.name, username: user.username, role: user.role })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('ponto_token', fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return res
}
