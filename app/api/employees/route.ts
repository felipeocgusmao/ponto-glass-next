import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

async function requireAdmin() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyJWT(token)
    return user.role === 'admin' ? user : null
  } catch { return null }
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, username, role, active, created_at')
    .eq('active', true)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, username, password, role } = await request.json()

  if (!name || !username || !password)
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })

  const trimmedName = String(name).trim()
  const trimmedUsername = String(username).trim().toLowerCase()

  if (trimmedName.length < 2 || trimmedName.length > 100)
    return NextResponse.json({ error: 'Nome deve ter entre 2 e 100 caracteres' }, { status: 400 })

  if (trimmedUsername.length < 3 || trimmedUsername.length > 50)
    return NextResponse.json({ error: 'Usuário deve ter entre 3 e 50 caracteres' }, { status: 400 })

  if (!/^[a-z0-9._-]+$/.test(trimmedUsername))
    return NextResponse.json({ error: 'Usuário só pode conter letras, números, ponto, hífen e underscore' }, { status: 400 })

  if (password.length < 6 || password.length > 100)
    return NextResponse.json({ error: 'Senha deve ter entre 6 e 100 caracteres' }, { status: 400 })

  if (!['admin', 'employee'].includes(role))
    return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })

  const { data: existing } = await supabase
    .from('employees').select('id').eq('username', trimmedUsername).single()

  if (existing)
    return NextResponse.json({ error: 'Usuário já existe' }, { status: 400 })

  const hash = await bcrypt.hash(password, 10)
  const { data, error } = await supabase
    .from('employees')
    .insert({ name: trimmedName, username: trimmedUsername, password_hash: hash, role })
    .select('id, name, username, role, active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
