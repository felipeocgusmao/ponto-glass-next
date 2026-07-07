'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DayException } from '@/lib/types'
import { SL } from '../../_lib/helpers'
import { businessDate } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'
import { IconChevronRight } from '../icons'

type ViewMode = 'list' | 'calendar'

function pad(n: number) { return String(n).padStart(2, '0') }

export function FeriadosTab() {
  const { t } = useLang()
  const [exceptions, setExceptions] = useState<DayException[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('list')
  const today = useMemo(() => businessDate(), [])
  const [calYM, setCalYM] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }))
  const [date, setDate] = useState(() => businessDate())
  const [type, setType] = useState<'holiday' | 'day_off'>('holiday')
  const [description, setDescription] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/day-exceptions')
      if (res.ok) setExceptions(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setOk(''); setSaving(true)
    const res = await fetch('/api/day-exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, type, description: description.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? t('error.connect')); setSaving(false); return }
    setOk(t('fer.saved')); setDescription(''); setSaving(false)
    await load()
    setTimeout(() => setOk(''), 3000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('fer.del_confirm'))) return
    const res = await fetch(`/api/day-exceptions/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setErr(d.error ?? t('error.connect')); return }
    await load()
  }

  const typeLabel = (excType: string): string =>
    t(('fer.type.' + excType) as TranslationKey)

  return (
    <>
      {/* Page header */}
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.feriados')}</div>
          <div className="page-sub">{exceptions.length > 0 ? `${exceptions.length} ${t('common.records')}` : t('fer.none')}</div>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>Lista</button>
            <button className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}>Calendário</button>
          </div>
        </div>
      </div>

      {view === 'calendar' && (
        <CalendarView
          year={calYM.year}
          month={calYM.month}
          exceptions={exceptions}
          today={today}
          onPrev={() => setCalYM(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}
          onNext={() => setCalYM(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}
          onToday={() => setCalYM({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 })}
        />
      )}

      {view === 'list' && (<>
      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          <SL>{t('fer.add_title')}</SL>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <div className="form-grid-2">
              <div className="field">
                <label>{t('fer.date')}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" required />
              </div>
              <div className="field">
                <label>{t('fer.type')}</label>
                <select value={type} onChange={e => setType(e.target.value as 'holiday' | 'day_off')} className="input">
                  <option value="holiday">{t('fer.type.holiday')}</option>
                  <option value="day_off">{t('fer.type.day_off')}</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>{t('fer.description')}</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t('fer.desc_ph')} className="input" required />
            </div>
            {err && <div className="alert-inline err">{err}</div>}
            {ok  && <div className="alert-inline ok">{ok}</div>}
            <button type="submit" disabled={saving} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? t('fer.saving') : t('fer.add_btn')}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px' }}>
          {loading
            ? <div className="alert-inline info">{t('common.loading')}</div>
            : exceptions.length === 0
            ? <div className="alert-inline info">{t('fer.none')}</div>
            : (
              <>
                <SL>{exceptions.length} {t('common.records')}</SL>
                {exceptions.map(exc => (
                  <div key={exc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{exc.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                        {new Date(exc.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span className={`chip ${exc.type === 'holiday' ? 'accent' : 'success'}`} style={{ fontSize: 10 }}>
                      {typeLabel(exc.type)}
                    </span>
                    <button onClick={() => handleDelete(exc.id)} className="btn danger sm icon">✕</button>
                  </div>
                ))}
              </>
            )
          }
        </div>
      </div>
      </>)}
    </>
  )
}

function CalendarView({
  year, month, exceptions, today,
  onPrev, onNext, onToday,
}: {
  year: number
  month: number
  exceptions: DayException[]
  today: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDow = (firstDay.getDay() + 6) % 7 // monday = 0

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthLabel = new Date(year, month, 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title" style={{ textTransform: 'capitalize' }}>{monthLabel}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost sm icon" onClick={onPrev} title="Mês anterior">
            <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><IconChevronRight size={12}/></span>
          </button>
          <button className="btn ghost sm" onClick={onToday}>Hoje</button>
          <button className="btn ghost sm icon" onClick={onNext} title="Próximo mês"><IconChevronRight size={12}/></button>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
            <div key={d} style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, padding: '6px 0', textAlign: 'center' }}>
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            const date = d ? `${year}-${pad(month + 1)}-${pad(d)}` : null
            const events = date ? exceptions.filter(h => h.date === date) : []
            const isToday = date === today
            const isWeekend = d != null && (i % 7 === 5 || i % 7 === 6)
            const isHoliday = events.some(e => e.type === 'holiday')
            const isDayOff = events.some(e => e.type === 'day_off')
            return (
              <div key={i} style={{
                minHeight: 70,
                padding: 6,
                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                background: isHoliday ? 'var(--accent-soft)' : isDayOff ? 'var(--success-soft, var(--surface-2))' : isWeekend ? 'var(--surface-2)' : 'var(--surface)',
                opacity: d ? 1 : 0.4,
                position: 'relative',
                fontSize: 12,
              }}>
                {d && (
                  <>
                    <div style={{ fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : isHoliday ? 'var(--accent-soft-fg)' : 'var(--fg)' }} className="tnum">{d}</div>
                    {events.map(ev => (
                      <div key={ev.id} style={{
                        fontSize: 10.5, marginTop: 4, lineHeight: 1.2,
                        color: ev.type === 'holiday' ? 'var(--accent-soft-fg)' : 'var(--fg-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={ev.description}>
                        {ev.description}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
