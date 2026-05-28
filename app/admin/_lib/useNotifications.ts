'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Employee, PunchRecord } from '@/lib/types'
import { businessDate } from '@/lib/utils'
import type { Tab } from './types'

export type NotifKind = 'corrections' | 'missing_exit' | 'absent'
export type Notif = {
  id: string
  kind: NotifKind
  title: string
  description: string
  tab: Tab
}

export function useNotifications({
  pendingCorrections,
  employees,
}: {
  pendingCorrections: number
  employees: Employee[]
}): { items: Notif[]; refresh: () => void } {
  // Use a primitive count for the effect dependency so the load function does not get
  // a new reference on every parent re-render. Employees rarely change identity here,
  // but isolating to a number keeps the loop intent explicit.
  const totalActiveNonAdmin = employees.filter(e => e.role !== 'admin' && e.active !== false).length

  const [missingExitToday, setMissingExitToday] = useState(0)
  const [missingExitYesterday, setMissingExitYesterday] = useState(0)
  const [absentToday, setAbsentToday] = useState(0)

  const load = useCallback(async () => {
    const today = businessDate()
    const anchor = new Date(`${today}T12:00:00Z`)
    const yesterday = new Date(anchor); yesterday.setUTCDate(anchor.getUTCDate() - 1)
    const fromDate = yesterday.toISOString().split('T')[0]
    const dow = anchor.getUTCDay()
    const isBusinessDay = dow !== 0 && dow !== 6

    try {
      const res = await fetch(`/api/reports?from=${fromDate}&to=${today}`)
      if (!res.ok) return
      const records: PunchRecord[] = await res.json()
      const byEmpDate = new Map<string, Map<string, PunchRecord[]>>()
      records.forEach(r => {
        if (!byEmpDate.has(r.employee_id)) byEmpDate.set(r.employee_id, new Map())
        const dm = byEmpDate.get(r.employee_id)!
        if (!dm.has(r.date)) dm.set(r.date, [])
        dm.get(r.date)!.push(r)
      })

      let tCount = 0, yCount = 0
      byEmpDate.forEach((dm) => {
        dm.forEach((dayRecs, date) => {
          const ts = (r: PunchRecord) => new Date(r.timestamp).getTime()
          const saidas = dayRecs.filter(r => r.type === 'saída')
          const entradas = dayRecs.filter(r => r.type === 'entrada')
          let isMissing = false
          if (saidas.length === 0 && entradas.length > 0) isMissing = true
          else if (saidas.length > 0 && entradas.length > 0) {
            const lastSaida = saidas.reduce((a, b) => ts(a) >= ts(b) ? a : b)
            const lastEntrada = entradas.reduce((a, b) => ts(a) >= ts(b) ? a : b)
            if (ts(lastEntrada) > ts(lastSaida)) isMissing = true
          }
          if (!isMissing) return
          if (date === today) tCount++
          else if (date === fromDate) yCount++
        })
      })
      setMissingExitToday(tCount)
      setMissingExitYesterday(yCount)

      if (isBusinessDay) {
        const empsWithRecsToday = new Set<string>()
        records.forEach(r => { if (r.date === today) empsWithRecsToday.add(r.employee_id) })
        setAbsentToday(Math.max(0, totalActiveNonAdmin - empsWithRecsToday.size))
      } else {
        setAbsentToday(0)
      }
    } catch { /* silent */ }
  }, [totalActiveNonAdmin])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const iv = setInterval(load, 60_000)
    const onRec = () => load()
    const onFocus = () => load()
    window.addEventListener('pg:records-changed', onRec)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(iv)
      window.removeEventListener('pg:records-changed', onRec)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const items: Notif[] = []
  if (pendingCorrections > 0) {
    items.push({
      id: 'corrections',
      kind: 'corrections',
      title: pendingCorrections === 1 ? '1 pedido de correção pendente' : `${pendingCorrections} pedidos de correção pendentes`,
      description: 'Toque para rever e aprovar.',
      tab: 'correcoes',
    })
  }
  if (missingExitToday > 0) {
    items.push({
      id: 'missing_today',
      kind: 'missing_exit',
      title: missingExitToday === 1 ? '1 funcionário sem saída hoje' : `${missingExitToday} funcionários sem saída hoje`,
      description: 'Ver e registar saída em falta.',
      tab: 'status',
    })
  }
  if (missingExitYesterday > 0) {
    items.push({
      id: 'missing_yesterday',
      kind: 'missing_exit',
      title: missingExitYesterday === 1 ? '1 saída em falta ontem' : `${missingExitYesterday} saídas em falta ontem`,
      description: 'Ajustar manualmente no histórico.',
      tab: 'registros',
    })
  }
  if (absentToday > 0) {
    items.push({
      id: 'absent',
      kind: 'absent',
      title: absentToday === 1 ? '1 funcionário sem registo hoje' : `${absentToday} funcionários sem registo hoje`,
      description: 'Pode ser folga, falta ou esquecimento.',
      tab: 'status',
    })
  }

  return { items, refresh: load }
}
