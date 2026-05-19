import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

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
