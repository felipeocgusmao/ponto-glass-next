import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'

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
    .eq('username', String(username).trim().toLowerCase())
    .eq('active', true)
    .single()

  if (!employee) {
    // Compare against a valid dummy hash so response timing doesn't reveal whether the user exists.
    await bcrypt.compare(password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
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

  logAudit({ id: employee.id, name: employee.name }, 'employee_login', null, { ip, username: employee.username })

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
