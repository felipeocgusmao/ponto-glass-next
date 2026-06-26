'use client'

import { useCallback, useState } from 'react'

type CorrectionStatus = 'pending' | 'approved' | 'rejected'
export interface CorrReq {
  id: string
  req_type: string
  req_timestamp: string
  req_date: string
  reason: string | null
  status: CorrectionStatus
  reviewer_note: string | null
  created_at: string
}

interface Options {
  t: (key: string) => string
  initialDate: string
  initialTime: string
}

export function useCorrectionRequests({ t, initialDate, initialTime }: Options) {
  const [corrList, setCorrList] = useState<CorrReq[]>([])
  const [corrLoaded, setCorrLoaded] = useState(false)
  const [corrLoading, setCorrLoading] = useState(false)
  const [corrBadge, setCorrBadge] = useState(0)
  const [corrDate, setCorrDate] = useState(initialDate)
  const [corrTime, setCorrTime] = useState(initialTime)
  const [corrType, setCorrType] = useState('entrada')
  const [corrReason, setCorrReason] = useState('')
  const [corrSubmitting, setCorrSubmitting] = useState(false)
  const [corrMsg, setCorrMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadCorrections = useCallback(async () => {
    if (corrLoaded) return
    setCorrLoading(true)
    try {
      const res = await fetch('/api/correction-requests')
      if (res.ok) {
        const list: CorrReq[] = await res.json()
        setCorrList(list)
        setCorrLoaded(true)
        const seenRaw = localStorage.getItem('pg.corr_seen')
        const seen: Set<string> = seenRaw ? new Set(JSON.parse(seenRaw)) : new Set()
        const newResolved = list.filter(c => c.status !== 'pending' && !seen.has(c.id))
        setCorrBadge(newResolved.length)
      }
    } catch { /* keep */ }
    finally { setCorrLoading(false) }
  }, [corrLoaded])

  const submitCorrection = async () => {
    if (!corrDate || !corrTime || !corrType) return
    if (!corrReason.trim()) { setCorrMsg({ ok: false, text: t('corr.reason_req') }); return }
    setCorrSubmitting(true); setCorrMsg(null)
    try {
      // Convert the chosen local wall-clock to a UTC instant, exactly like real punches
      // (now.toISOString()) and manual records. Sending a naive string lets the DB (timestamptz)
      // treat it as UTC, shifting the corrected time by the user's timezone offset.
      const timestamp = new Date(`${corrDate}T${corrTime}:00`).toISOString()
      const res = await fetch('/api/correction-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: corrType, timestamp, reason: corrReason || undefined }),
      })
      if (res.ok) {
        setCorrMsg({ ok: true, text: t('corr.success') })
        setCorrReason('')
        setCorrLoaded(false)
        await loadCorrections()
      } else {
        const d = await res.json()
        setCorrMsg({ ok: false, text: d.error ?? 'Erro ao enviar pedido.' })
      }
    } catch { setCorrMsg({ ok: false, text: 'Erro de conexão.' }) }
    finally { setCorrSubmitting(false) }
  }

  const markCorrectionsSeen = useCallback((list: CorrReq[]) => {
    const ids = list.filter(c => c.status !== 'pending').map(c => c.id)
    localStorage.setItem('pg.corr_seen', JSON.stringify(ids))
    setCorrBadge(0)
  }, [])

  return {
    corrList, corrLoaded, corrLoading, corrBadge,
    corrDate, setCorrDate,
    corrTime, setCorrTime,
    corrType, setCorrType,
    corrReason, setCorrReason,
    corrSubmitting, corrMsg,
    loadCorrections, submitCorrection, markCorrectionsSeen,
  }
}
