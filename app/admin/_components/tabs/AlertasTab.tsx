'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLang } from '@/lib/LangContext'

interface AlertSettings {
  hour_bank_low_threshold: number | null
  long_day_threshold: number | null
  hour_bank_max_positive: number | null
}

export function AlertasTab() {
  const { t } = useLang()
  const [settings, setSettings] = useState<AlertSettings>({ hour_bank_low_threshold: null, long_day_threshold: null, hour_bank_max_positive: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testSending, setTestSending] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Local form state (in hours for UX, stored as minutes)
  const [bankHours, setBankHours] = useState('')
  const [dayHours,  setDayHours]  = useState('')
  const [maxBankHours, setMaxBankHours] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tenant-settings')
      if (res.ok) {
        const d: AlertSettings = await res.json()
        setSettings(d)
        setBankHours(d.hour_bank_low_threshold !== null ? String(Math.abs(d.hour_bank_low_threshold) / 60) : '')
        setDayHours(d.long_day_threshold !== null ? String(d.long_day_threshold / 60) : '')
        setMaxBankHours(d.hour_bank_max_positive !== null ? String(d.hour_bank_max_positive / 60) : '')
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const payload: Partial<AlertSettings> = {
        hour_bank_low_threshold: bankHours ? -(parseFloat(bankHours) * 60) : null,
        long_day_threshold: dayHours ? parseFloat(dayHours) * 60 : null,
        hour_bank_max_positive: maxBankHours ? parseFloat(maxBankHours) * 60 : null,
      }
      const res = await fetch('/api/tenant-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const d = await res.json()
        setSettings(d)
        setMsg({ ok: true, text: t('alertas.saved') })
      } else {
        const d = await res.json()
        setMsg({ ok: false, text: d.error ?? t('alertas.err.save') })
      }
    } catch { setMsg({ ok: false, text: t('alertas.err.connect') }) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.alertas')}</div>
          <div className="page-sub">{t('alertas.subtitle')}</div>
        </div>
      </div>

      {loading ? (
        <div className="card"><div style={{ padding: '20px', color: 'var(--fg-muted)' }}>{t('common.loading')}</div></div>
      ) : (
        <div className="card">
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('alertas.bank_neg.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 10 }}>
                {t('alertas.bank_neg.desc')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={bankHours}
                  onChange={e => setBankHours(e.target.value)}
                  placeholder="ex: 2"
                  className="input"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{t('alertas.bank_neg.unit')}</span>
                {bankHours && <span className="chip warn" style={{ fontSize: 11 }}>{t('alertas.bank_neg.chip').replace('{n}', bankHours)}</span>}
                {!bankHours && <span className="chip" style={{ fontSize: 11 }}>{t('alertas.disabled')}</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('alertas.long_day.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 10 }}>
                {t('alertas.long_day.desc')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={dayHours}
                  onChange={e => setDayHours(e.target.value)}
                  placeholder="ex: 10"
                  className="input"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{t('alertas.long_day.unit')}</span>
                {dayHours && <span className="chip warn" style={{ fontSize: 11 }}>{t('alertas.long_day.chip').replace('{n}', dayHours)}</span>}
                {!dayHours && <span className="chip" style={{ fontSize: 11 }}>{t('alertas.disabled')}</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('alertas.max_bank.title')}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 10 }}>
                {t('alertas.max_bank.desc')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={maxBankHours}
                  onChange={e => setMaxBankHours(e.target.value)}
                  placeholder="ex: 40"
                  className="input"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{t('alertas.max_bank.unit')}</span>
                {maxBankHours && <span className="chip warn" style={{ fontSize: 11 }}>{t('alertas.max_bank.chip').replace('{n}', maxBankHours)}</span>}
                {!maxBankHours && <span className="chip" style={{ fontSize: 11 }}>{t('alertas.disabled')}</span>}
              </div>
            </div>

            {msg && <div className={`alert-inline ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? t('alertas.saving') : t('alertas.save_btn')}
              </button>
              <button className="btn ghost" onClick={load} disabled={loading}>{t('common.cancel')}</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('alertas.test_btn')}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 10 }}>
                {t('alertas.note_text')}
              </div>
              {testMsg && <div className={`alert-inline ${testMsg.ok ? 'ok' : 'err'}`} style={{ marginBottom: 10 }}>{testMsg.text}</div>}
              <button
                className="btn"
                disabled={testSending}
                onClick={async () => {
                  setTestSending(true); setTestMsg(null)
                  try {
                    const res = await fetch('/api/tenant-settings/test-notification', { method: 'POST' })
                    if (res.status === 404) {
                      setTestMsg({ ok: false, text: t('alertas.test_no_sub') })
                    } else if (res.ok) {
                      setTestMsg({ ok: true, text: t('alertas.test_sent') })
                    } else {
                      setTestMsg({ ok: false, text: t('alertas.test_err') })
                    }
                  } catch { setTestMsg({ ok: false, text: t('alertas.test_err') }) }
                  finally { setTestSending(false) }
                }}
              >
                {testSending ? t('common.loading') : t('alertas.test_btn')}
              </button>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--fg-muted)' }}>
              <strong>{t('alertas.note')}</strong> {t('alertas.note_text')}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
