import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import type { PunchRecord } from '@/lib/types'

function icsDate(iso: string): string {
  // Format: YYYYMMDDTHHmmssZ
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function buildIcs(records: PunchRecord[], employeeName: string): string {
  // Group by date
  const byDate = new Map<string, PunchRecord[]>()
  records.forEach(r => {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date)!.push(r)
  })

  const events: string[] = []

  byDate.forEach((dayRecs, date) => {
    const sorted = [...dayRecs].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    const entradas = sorted.filter(r => r.type === 'entrada')
    const saidas = sorted.filter(r => r.type === 'saída')
    if (!entradas.length) return

    const start = entradas[0].timestamp
    const end = saidas.length ? saidas[saidas.length - 1].timestamp : null

    const workedMs = (() => {
      let total = 0
      let lastEntrada: string | null = null
      for (const r of sorted) {
        if (['entrada', 'fim_almoco', 'retorno_cafe'].includes(r.type)) {
          lastEntrada = r.timestamp
        } else if (['saída', 'inicio_almoco', 'pausa_cafe'].includes(r.type) && lastEntrada) {
          total += new Date(r.timestamp).getTime() - new Date(lastEntrada).getTime()
          lastEntrada = null
        }
      }
      return total
    })()
    const workedH = Math.floor(workedMs / 3_600_000)
    const workedM = Math.round((workedMs % 3_600_000) / 60_000)
    const workedLabel = `${workedH}h${String(workedM).padStart(2, '0')}`

    const dtStart = icsDate(start)
    const dtEnd = end ? icsDate(end) : icsDate(start)
    const uid = `${date}-${sorted[0].employee_id}@ponto-glass`

    const description = [
      `Entrada: ${new Date(start).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}`,
      end ? `Saída: ${new Date(end).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}` : null,
      `Total: ${workedLabel}`,
    ].filter(Boolean).join(' | ')

    events.push([
      'BEGIN:VEVENT',
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:Trabalho ${workedLabel} — ${employeeName}`,
      `DESCRIPTION:${description}`,
      `UID:${uid}`,
      'END:VEVENT',
    ].join('\r\n'))
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PontoGlass//Calendar//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export async function GET(request: NextRequest) {
  const token = cookies().get('ponto_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user: ApiUser
  try { user = await verifyApiAuth(token) }
  catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const requestedId = searchParams.get('employeeId')

  if (!from || !to)
    return NextResponse.json({ error: 'Parâmetros from e to são obrigatórios' }, { status: 400 })

  const isPrivileged = ['admin', 'manager'].includes(user.role)
  if (!isPrivileged && requestedId && requestedId !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const employeeId = isPrivileged && requestedId ? requestedId : user.id

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .eq('employee_id', employeeId)
    .gte('date', from)
    .lte('date', to)
    .order('timestamp', { ascending: true })

  const { data: emp } = await supabase
    .from('employees')
    .select('name')
    .eq('id', employeeId)
    .maybeSingle()

  const ics = buildIcs((records ?? []) as PunchRecord[], emp?.name ?? user.name)

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="ponto_${from}_${to}.ics"`,
    },
  })
}
