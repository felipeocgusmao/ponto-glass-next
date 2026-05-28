'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DayException } from '@/lib/types'
import { SL } from '../../_lib/helpers'
import { businessDate } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'
import type { TranslationKey } from '@/lib/i18n'

export function FeriadosTab() {
  const { t } = useLang()
  const [exceptions, setExceptions] = useState<DayException[]>([])
  const [loading, setLoading] = useState(true)
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
      </div>

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
                  <div key={exc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
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
    </>
  )
}
