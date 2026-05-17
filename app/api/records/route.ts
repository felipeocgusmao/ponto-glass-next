import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyJWT(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { searchParams } = new URL(request.url)
  const today = searchParams.get('today') === 'true'
  const date = searchParams.get('date')
  const employeeId = searchParams.get('employeeId')
  const isAdmin = user.role === 'admin'

  let query = supabase.from('records').select('*').order('timestamp', { ascending: true })

  // Non-admins see only their own records
  if (!isAdmin) {
    query = query.eq('employee_id', user.id)
  } else if (employeeId && employeeId !== 'all') {
    query = query.eq('employee_id', employeeId)
  }

  if (today) {
    query = query.eq('date', new Date().toISOString().split('T')[0])
  } else if (date) {
    query = query.eq('date', date)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
