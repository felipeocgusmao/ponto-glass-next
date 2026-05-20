import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { type, employeeId: targetId, latitude, longitude } = await request.json()
  if (!['entrada', 'saída', 'inicio_almoco', 'fim_almoco', 'pausa_cafe', 'retorno_cafe'].includes(type))
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  let empId = user.id
  let empName = user.name
  const onBehalf = targetId && targetId !== user.id

  if (onBehalf) {
    if (!['admin', 'manager'].includes(user.role))
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
  const geoFields = (typeof latitude === 'number' && typeof longitude === 'number')
    ? { latitude, longitude }
    : {}

  const { data, error } = await supabase
    .from('records')
    .insert({
      employee_id: empId,
      employee_name: empName,
      type,
      timestamp: now.toISOString(),
      date: now.toISOString().split('T')[0],
      ...geoFields,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (onBehalf) {
    await logAudit(user, 'punch_on_behalf', { id: empId, name: empName }, { type })
  }

  return NextResponse.json(data)
}
