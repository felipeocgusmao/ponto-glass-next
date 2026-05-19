import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { type, employeeId: targetId } = await request.json()
  if (!['entrada', 'saída'].includes(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  let empId = user.id
  let empName = user.name

  if (targetId && targetId !== user.id) {
    if (user.role !== 'admin')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const { data: emp } = await supabase
      .from('employees')
      .select('id, name')
      .eq('id', targetId)
      .eq('active', true)
      .single()
    if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    empId = emp.id
    empName = emp.name
  }

  const now = new Date()
  const { data, error } = await supabase
    .from('records')
    .insert({
      employee_id: empId,
      employee_name: empName,
      type,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
