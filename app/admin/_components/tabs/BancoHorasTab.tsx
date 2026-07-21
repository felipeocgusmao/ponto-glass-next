'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Employee, HourBankAdjustment } from '@/lib/types'
import { fmtCentesimalSigned, businessDate, avatarInitials } from '@/lib/utils'
import { empColor } from '../../_lib/helpers'
import { useLang } from '@/lib/LangContext'
import { IconRefresh, IconArrowUp, IconArrowDown } from '../icons'

type Balance = { balanceMin: number; adjustments: HourBankAdjustment[] }

// Banco de horas (centesimal): +1,25 / −0,50
const fmtSigned = (min: number) => fmtCentesimalSigned(min)

export function BancoHorasTab({ employees }: { employees: Employee[] }) {
  const { t } = useLang()
  const [balances, setBalances] = useState<Map<string, Balance>>(new Map())
  const [selectedEmp, setSelectedEmp] = useState('')
  const [minutes, setMinutes] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(() => businessDate())
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingBalances, setLoadingBalances] = useState(false)
  // #291 — annual overtime cap (art. 228.º CT). annualLimit stays null when
  // the company hasn't opted in (Ajustes → Lei laboral); the column is hidden.
  const [annualOvertime, setAnnualOvertime] = useState<Record<string, number>>({})
  const [annualLimit, setAnnualLimit] = useState<number | null>(null)

  const loadAll = useCallback(async () => {
    setLoadingBalances(true)
    const map = new Map<string, Balance>()
    await Promise.all(employees.map(async emp => {
      try {
        const res = await fetch(`/api/hour-bank?employeeId=${emp.id}`)
        if (res.ok) { const d = await res.json(); map.set(emp.id, d) }
      } catch { /* silent */ }
    }))
    setBalances(new Map(map))
    setLoadingBalances(false)
    try {
      const res = await fetch('/api/hour-bank/annual-overtime')
      if (res.ok) {
        const d = await res.json()
        setAnnualLimit(d.limitMin ?? null)
        setAnnualOvertime(d.minutes ?? {})
      }
    } catch { /* silent — annual indicator is a bonus, not core to the tab */ }
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

  const rows = useMemo(() => {
    return employees
      .filter(e => e.role !== 'admin' && e.active !== false)
      .map(emp => {
        const info = balances.get(emp.id)
        const bal = info?.balanceMin ?? 0
        const last = info?.adjustments?.[0]
        return { emp, bal, hasData: info !== undefined, last }
      })
      .sort((a, b) => b.bal - a.bal)
  }, [employees, balances])

  const totalBalance = rows.reduce((acc, r) => acc + r.bal, 0)
  const positive = rows.filter(r => r.bal > 0).length
  const negative = rows.filter(r => r.bal < 0).length
  const zero = rows.filter(r => r.bal === 0).length

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.banco')}</div>
          <div className="page-sub">Saldo coletivo · ajustes manuais</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={loadAll} disabled={loadingBalances}>
            <IconRefresh size={13}/> Atualizar
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Saldo total</div>
          <div className="kpi-value tnum" style={{ color: totalBalance >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
            {fmtSigned(totalBalance)}
          </div>
          <div className="kpi-delta">{t('hbank.emp_count').replace('{n}', String(rows.length))}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Positivos</div>
          <div className="kpi-value tnum">{positive}</div>
          <div className="kpi-delta up"><IconArrowUp size={11}/> {t('hbank.in_favor')}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Negativos</div>
          <div className="kpi-value tnum">{negative}</div>
          <div className="kpi-delta down"><IconArrowDown size={11}/> a compensar</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Zerados</div>
          <div className="kpi-value tnum">{zero}</div>
          <div className="kpi-delta">sem saldo pendente</div>
        </div>
      </div>

      {/* Saldos por funcionário */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">{t('hbank.by_emp')}</div>
        </div>
        {rows.length === 0 ? (
          <div className="empty"><div className="title">{t('hbank.none_emp')}</div></div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Funcionário</th>
                <th className="right">Saldo</th>
                <th>Tendência</th>
                {annualLimit != null && <th className="right">Suplementar no ano</th>}
                <th className="right">Última alteração</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ emp, bal, hasData, last }) => {
                const maxRef = 360 // 6h reference for full bar
                const balPct = Math.min(100, Math.abs(bal) / maxRef * 100)
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="cell-emp">
                        <div className={`avatar size-22 av-c${empColor(emp.id)}`}>{avatarInitials(emp.name)}</div>
                        <div className="cell-emp-info">
                          <div className="cell-emp-name">{emp.name}</div>
                          <div className="cell-emp-sub">@{emp.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="right tnum" style={{ fontWeight: 600, color: bal > 0 ? 'var(--success-fg)' : bal < 0 ? 'var(--danger-fg)' : 'var(--fg-muted)' }}>
                      {hasData ? fmtSigned(bal) : <span className="muted">—</span>}
                    </td>
                    <td style={{ width: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 2, position: 'relative' }}>
                          <div style={{
                            position: 'absolute', top: 0, left: '50%',
                            width: `${balPct / 2}%`,
                            transform: bal < 0 ? 'translateX(-100%)' : 'none',
                            height: '100%',
                            background: bal > 0 ? 'var(--success-fg)' : bal < 0 ? 'var(--danger-fg)' : 'var(--fg-dim)',
                            borderRadius: 2,
                          }}/>
                          <div style={{ position: 'absolute', top: -2, left: 'calc(50% - 0.5px)', width: 1, height: 8, background: 'var(--fg-dim)' }}/>
                        </div>
                      </div>
                    </td>
                    {annualLimit != null && (() => {
                      const ot = annualOvertime[emp.id] ?? 0
                      const pct = Math.min(100, (ot / annualLimit) * 100)
                      const level = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'muted'
                      return (
                        <td className="right tnum" style={{ fontSize: 12 }}>
                          <span style={{ color: level === 'danger' ? 'var(--danger-fg)' : level === 'warn' ? 'var(--warning-fg)' : 'var(--fg-muted)', fontWeight: level === 'muted' ? 400 : 600 }}>
                            {Math.floor(ot / 60)}h
                          </span>
                          <span className="muted"> / {Math.floor(annualLimit / 60)}h</span>
                        </td>
                      )
                    })()}
                    <td className="right muted" style={{ fontSize: 12 }}>
                      {last
                        ? <span>{last.date} <span style={{ color: last.minutes > 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }}>({fmtCentesimalSigned(last.minutes)})</span></span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="right">
                      <button className="btn ghost sm" onClick={() => setSelectedEmp(emp.id)}>Ajustar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Lançar ajuste */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">{t('hbank.new_adj')}</div>
        </div>
        <div className="card-body">
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label>{t('reg.employee')}</label>
              <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="input">
                <option value="">{t('hbank.select')}</option>
                {employees.filter(e => e.role !== 'admin' && e.active !== false).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
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
            <button type="submit" disabled={saving} className="btn primary" style={{ alignSelf: 'flex-start' }}>
              {saving ? t('hbank.saving') : t('hbank.add_btn')}
            </button>
            <div className="muted" style={{ fontSize: 11.5 }}>Ajustes ficam registrados na auditoria.</div>
          </form>
        </div>
      </div>

      {/* Histórico do funcionário seleccionado */}
      {selectedEmp && (() => {
        const adjs = balances.get(selectedEmp)?.adjustments ?? []
        if (adjs.length === 0) return null
        const empName = employees.find(e => e.id === selectedEmp)?.name ?? ''
        return (
          <div className="card">
            <div className="card-head">
              <div className="card-title">{t('hbank.adj_of')} {empName}</div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Data</th>
                  <th>Motivo</th>
                  <th className="right">Minutos</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {adjs.map(a => (
                  <tr key={a.id}>
                    <td className="tnum muted" style={{ fontSize: 12 }}>{a.date}</td>
                    <td>{a.reason}</td>
                    <td className="right tnum" style={{ fontWeight: 600, color: a.minutes >= 0 ? 'var(--success-fg)' : 'var(--danger-fg)' }} title={`${a.minutes >= 0 ? '+' : ''}${a.minutes} min`}>
                      {fmtCentesimalSigned(a.minutes)}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(a.id)} className="btn ghost sm icon" title="Remover">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })()}
    </>
  )
}
