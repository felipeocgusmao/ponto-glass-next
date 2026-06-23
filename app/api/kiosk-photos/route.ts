import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { isCsrfSafe } from '@/lib/csrf'

const MAX_PHOTO_BYTES = 300 * 1024 // 300KB

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { recordId, photoData } = body as { recordId?: string; photoData?: string }

  if (!recordId) return NextResponse.json({ error: 'recordId is required' }, { status: 400 })
  if (!photoData) return NextResponse.json({ error: 'photoData is required' }, { status: 400 })
  if (Buffer.byteLength(photoData, 'utf8') > MAX_PHOTO_BYTES)
    return NextResponse.json({ error: 'Foto muito grande (máx 300KB)' }, { status: 413 })

  const { data, error } = await supabase
    .from('kiosk_photos')
    .insert({
      tenant_id: user.tenant_id,
      record_id: recordId,
      photo_data: photoData,
    })
    .select()
    .single()

  if (error?.code === '42P01') return NextResponse.json({ success: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const recordId = new URL(request.url).searchParams.get('recordId')
  if (!recordId) return NextResponse.json({ error: 'recordId is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('kiosk_photos')
    .select('id, photo_data, created_at')
    .eq('tenant_id', user.tenant_id)
    .eq('record_id', recordId)
    .maybeSingle()

  if (error?.code === '42P01') return NextResponse.json(null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
