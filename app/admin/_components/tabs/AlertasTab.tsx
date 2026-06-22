'use client'

import { useState, useEffect, useCallback } from 'react'

interface AlertSettings {
  hour_bank_low_threshold: number | null
  long_day_threshold: number | null
}

export function AlertasTab() {
  const [settings, setSettings] = useState<AlertSettings>({ hour_bank_low_threshold: null, long_day_threshold: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Local form state (in hours for UX, stored as minutes)
  const [bankHours, setBankHours] = useState('')
  const [dayHours,  setDayHours]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tenant-settings')
      if (res.ok) {
        const d: AlertSettings = await res.json()
        setSettings(d)
        setBankHours(d.hour_bank_low_threshold !== null ? String(Math.abs(d.hour_bank_low_threshold) / 60) : '')
        setDayHours(d.long_day_threshold !== null ? String(d.long_day_threshold / 60) : '')
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
      }
      const res = await fetch('/api/tenant-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const d = await res.json()
        setSettings(d)
        setMsg({ ok: true, text: 'Alertas guardados com sucesso.' })
      } else {
        const d = await res.json()
        setMsg({ ok: false, text: d.error ?? 'Erro ao guardar.' })
      }
    } catch { setMsg({ ok: false, text: 'Erro de conexão.' }) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Alertas</div>
          <div className="page-sub">Configure notificações automáticas por push para administradores</div>
        </div>
      </div>

      {loading ? (
        <div className="card"><div style={{ padding: '20px', color: 'var(--fg-muted)' }}>A carregar…</div></div>
      ) : (
        <div className="card">
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Banco de horas negativo</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 10 }}>
                Envia uma notificação push quando o saldo de banco de horas de um funcionário ficar abaixo deste valor.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>horas negativas</span>
                {bankHours && <span className="chip warn" style={{ fontSize: 11 }}>alerta se saldo &lt; -{bankHours}h</span>}
                {!bankHours && <span className="chip" style={{ fontSize: 11 }}>desativado</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Jornada muito longa</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 10 }}>
                Envia uma notificação push no final do dia quando um funcionário trabalhar mais do que este limite.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>horas/dia</span>
                {dayHours && <span className="chip warn" style={{ fontSize: 11 }}>alerta se &gt; {dayHours}h/dia</span>}
                {!dayHours && <span className="chip" style={{ fontSize: 11 }}>desativado</span>}
              </div>
            </div>

            {msg && <div className={`alert-inline ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" onClick={save} disabled={saving}>
                {saving ? 'A guardar…' : 'Guardar configurações'}
              </button>
              <button className="btn ghost" onClick={load} disabled={loading}>Cancelar</button>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--fg-muted)' }}>
              <strong>Nota:</strong> As notificações requerem push web ativo. O cron de verificação corre todos os dias de semana às 18h. Deixe vazio para desativar um alerta.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
