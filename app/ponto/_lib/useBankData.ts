'use client'

import { useCallback, useState } from 'react'

type CorrectionStatus = 'pending' | 'approved' | 'rejected'
export interface CompReq {
  id: string
  date: string
  hours_requested: number
  reason: string
  status: CorrectionStatus
  reviewer_note: string | null
  created_at: string
}

interface Options {
  t: (key: string) => string
  initialDate: string
}

export function useBankData({ t, initialDate }: Options) {
  const [bankBalance, setBankBalance] = useState<number | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankLoaded, setBankLoaded] = useState(false)

  const [compList, setCompList] = useState<CompReq[]>([])
  const [compLoaded, setCompLoaded] = useState(false)
  const [compLoading, setCompLoading] = useState(false)
  const [compDate, setCompDate] = useState(initialDate)
  const [compHours, setCompHours] = useState('')
  const [compReason, setCompReason] = useState('')
  const [compSubmitting, setCompSubmitting] = useState(false)
  const [compMsg, setCompMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadBank = useCallback(async () => {
    if (bankLoaded) return
    setBankLoading(true)
    try {
      const res = await fetch('/api/hour-bank')
      if (res.ok) {
        const d = await res.json()
        setBankBalance(d.balanceMin)
        setBankLoaded(true)
      }
    } catch { /* keep */ }
    finally { setBankLoading(false) }
  }, [bankLoaded])

  const loadCompensation = useCallback(async () => {
    if (compLoaded) return
    setCompLoading(true)
    try {
      const res = await fetch('/api/compensation-requests')
      if (res.ok) { setCompList(await res.json()); setCompLoaded(true) }
    } catch { /* keep */ }
    finally { setCompLoading(false) }
  }, [compLoaded])

  const submitCompensation = async () => {
    if (!compHours || parseFloat(compHours) <= 0) { setCompMsg({ ok: false, text: t('comp.hours_req') }); return }
    if (!compDate) { setCompMsg({ ok: false, text: t('comp.date_req') }); return }
    if (!compReason.trim()) { setCompMsg({ ok: false, text: t('comp.reason_req') }); return }
    setCompSubmitting(true); setCompMsg(null)
    try {
      const res = await fetch('/api/compensation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: compDate, hours_requested: parseFloat(compHours), reason: compReason.trim() }),
      })
      if (res.ok) {
        setCompMsg({ ok: true, text: t('comp.success') })
        setCompHours(''); setCompReason('')
        setCompLoaded(false)
        await loadCompensation()
      } else {
        const d = await res.json()
        setCompMsg({ ok: false, text: d.error ?? t('comp.err.generic') })
      }
    } catch { setCompMsg({ ok: false, text: t('comp.err.connect') }) }
    finally { setCompSubmitting(false) }
  }

  return {
    bankBalance, bankLoading, bankLoaded,
    compList, compLoaded, compLoading,
    compDate, setCompDate,
    compHours, setCompHours,
    compReason, setCompReason,
    compSubmitting, compMsg,
    loadBank, loadCompensation, submitCompensation,
  }
}
