import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { workday_hours, lunch_break_minutes, hourly_rate } = await request.json()

  const parsedWorkday = Number(workday_hours)
  const parsedLunch   = Number(lunch_break_minutes)
  const parsedRate    = hourly_rate != null && hourly_rate !== '' ? Number(hourly_rate) : null

  if (isNaN(parsedWorkday) || parsedWorkday < 1 || parsedWorkday > 24)
    return NextResponse.json({ error: 'Jornada inválida' }, { status: 400 })
  if (isNaN(parsedLunch) || parsedLunch < 0 || parsedLunch > 120)
    return NextResponse.json({ error: 'Desconto de almoço inválido' }, { status: 400 })
  if (parsedRate !== null && (isNaN(parsedRate) || parsedRate < 0))
    return NextResponse.json({ error: 'Valor da hora inválido' }, { status: 400 })

  const { data, error } = await supabase
    .from('employees')
    .update({ workday_hours: parsedWorkday, lunch_break_minutes: parsedLunch, hourly_rate: parsedRate })
    .eq('id', params.id)
    .select('id, name, username, role, active, created_at, workday_hours, lunch_break_minutes, hourly_rate')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (params.id === user.id) return NextResponse.json({ error: 'Não é possível desativar sua própria conta' }, { status: 400 })

  const { data: target } = await supabase
    .from('employees')
    .select('role')
    .eq('id', params.id)
    .single()

  if (!target) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  if (target.role === 'admin') {
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('active', true)

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Não é possível remover o último administrador' },
        { status: 400 }
      )
    }
  }

  const { error } = await supabase
    .from('employees')
    .update({ active: false })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
