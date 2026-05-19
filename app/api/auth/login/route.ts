import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!rateLimit(`login:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429 }
    )
  }

  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 })
  }

  // Auto-seed: create default admin if DB is empty
  const { count } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })

  if (count === 0) {
    const hash = await bcrypt.hash('admin123', 10)
    await supabase.from('employees').insert({
      name: 'Administrador',
      username: 'admin',
      password_hash: hash,
      role: 'admin',
    })
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('username', username.trim())
    .eq('active', true)
    .single()

  if (!employee) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, employee.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 })
  }

  const token = await createJWT({
    id: employee.id,
    name: employee.name,
    username: employee.username,
    role: employee.role,
  })

  const res = NextResponse.json({ success: true, role: employee.role })
  res.cookies.set('ponto_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return res
}
