import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import { supabase } from '@/lib/supabase'
import { createHmac } from 'crypto'
import QRCode from 'qrcode'

function qrToken(employeeId: string, tenantId: string): string {
  const secret = process.env.QR_SECRET ?? process.env.JWT_SECRET ?? 'qr-fallback'
  return createHmac('sha256', secret)
    .update(`${employeeId}:${tenantId}`)
    .digest('base64url')
    .slice(0, 32)
}

// Admin-only: returns a QR code data URL for a specific employee.
// The QR encodes the kiosk confirm URL with a tamper-proof token.
export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  if (!['admin', 'manager'].includes(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employeeId')
  if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 })

  const { data: emp } = await supabase
    .from('employees')
    .select('id, name')
    .eq('tenant_id', user.tenant_id)
    .eq('id', employeeId)
    .eq('active', true)
    .maybeSingle()

  if (!emp) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

  const t = qrToken(emp.id, user.tenant_id)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const confirmUrl = `${appUrl}/kiosk/confirm?emp=${emp.id}&tid=${user.tenant_id}&t=${t}`
  const dataUrl = await QRCode.toDataURL(confirmUrl, { errorCorrectionLevel: 'M', width: 256 })

  return NextResponse.json({ employeeId: emp.id, name: emp.name, qrDataUrl: dataUrl, confirmUrl })
}
