import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

async function requirePrivileged() {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyJWT(token)
    return ['admin', 'manager'].includes(user.role) ? user : null
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const actor = await requirePrivileged()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  let query = supabase
    .from('day_exceptions')
    .select('*')
    .order('date', { ascending: false })
    .limit(200)

  if (from) query = query.gte('date', from)
  if (to)   query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const actor = await requirePrivileged()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { date, type, description, employee_id } = await request.json()

  if (!date || !type || !description)
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })

  if (!['holiday', 'day_off'].includes(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: 'Data inválida' }, { status: 400 })

  const trimmedDesc = String(description).trim()
  if (trimmedDesc.length < 2 || trimmedDesc.length > 200)
    return NextResponse.json({ error: 'Descrição deve ter entre 2 e 200 caracteres' }, { status: 400 })

  const { data, error } = await supabase
    .from('day_exceptions')
    .insert({
      date,
      type,
      description: trimmedDesc,
      employee_id: employee_id || null,
      created_by: actor.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(actor, 'day_exception_create', null, { date, type, description: trimmedDesc })
  return NextResponse.json(data, { status: 201 })
}
