'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Employee, HourBankAdjustment } from '@/lib/types'
import { fmtMinutes } from '@/lib/utils'
import { SL } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'

export function BancoHorasTab({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
  const [balances, setBalances] = useState<Map<string, { balanceMin: number; adjustments: HourBankAdjustment[] }>>(new Map())
  const [selectedEmp, setSelectedEmp] = useState('')
  const [minutes, setMinutes] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    const map = new Map<string, { balanceMin: number; adjustments: HourBankAdjustment[] }>()
    await Promise.all(employees.map(async emp => {
      try {
        const res = await fetch(`/api/hour-bank?employeeId=${emp.id}`)
        if (res.ok) { const d = await res.json(); map.set(emp.id, d) }
      } catch { /* silent */ }
    }))
    setBalances(new Map(map))
  }, [employees])

  useEffect(() => { loadAll() }, [loadAll])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setSaving(true)
    const mins = Number(minutes)
    if (!selectedEmp) { setErr(t('hbank.select_emp')); setSaving(false); return }
    if (isNaN(mins) || mins === 0) { setErr(t('hbank.invalid_min')); setSaving(false); return }
    if (!reason.trim()) { setErr(t('hbank.reason_req')); setSaving(false); return }
    const res = await fetch('/api/hour-bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedEmp, minutes: mins, reason: reason.trim(), date }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? t('error.connect')); setSaving(false); return }
    setOk(t('hbank.saved')); setMinutes(''); setReason(''); setSaving(false)
    await loadAll()
    setTimeout(() => setOk(''), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('hbank.del_confirm'))) return
    const res = await fetch(`/api/hour-bank/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setErr(d.error ?? t('error.connect')); return }
    await loadAll()
  }

  return (
    <>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{t('hbank.balances')}</SL>
          {employees.length === 0 && <div className="alert-inline info">{t('hbank.none_emp')}</div>}
          {employees.map(emp => {
            const info = balances.get(emp.id)
            const bal = info?.balanceMin
            return (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--fg)' }}>{emp.name}</span>
                {bal !== undefined
                  ? <span style={{ fontSize: 13, fontWeight: 600, color: bal >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
                      {bal >= 0 ? '+' : '-'}{Math.floor(Math.abs(bal) / 60)}h{String(Math.abs(bal) % 60).padStart(2, '0')}m
                    </span>
                  : <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>—</span>
                }
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{t('hbank.new_adj')}</SL>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div className="field">
              <label>{t('reg.employee')}</label>
              <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="input">
                <option value="">{t('hbank.select')}</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="form-grid-2">
              <div className="field">
                <label>{t('hbank.minutes')}</label>
                <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder={t('hbank.minutes_ph')} className="input" />
              </div>
              <div className="field">
                <label>{t('hbank.date')}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
              </div>
            </div>
            <div className="field">
              <label>{t('hbank.reason')}</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('hbank.reason_ph')} className="input" />
            </div>
            {err && <div className="alert-inline err">{err}</div>}
            {ok  && <div className="alert-inline ok">{ok}</div>}
            <button type="submit" disabled={saving} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? t('hbank.saving') : t('hbank.add_btn')}
            </button>
          </form>
        </div>
      </div>

      {selectedEmp && (() => {
        const adjs = balances.get(selectedEmp)?.adjustments ?? []
        if (adjs.length === 0) return null
        const empName = employees.find(e => e.id === selectedEmp)?.name ?? ''
        return (
          <div className="card">
            <div style={{ padding: '16px 20px' }}>
              <SL>{t('hbank.adj_of')} {empName}</SL>
              {adjs.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--fg)' }}>{a.reason}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{a.date}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: a.minutes >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)', flexShrink: 0 }}>
                    {a.minutes >= 0 ? '+' : ''}{a.minutes}min
                  </span>
                  <button onClick={() => handleDelete(a.id)} className="btn danger sm icon">✕</button>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </>
  )
}
