'use client'

import { useState, useEffect, useCallback } from 'react'

// Company-wide settings, admin only. Currently the default work journey that
// pre-fills the form when creating a new employee. Persisted via
// /api/tenant-settings (stored in tenants.alert_settings JSONB).
export function AjustesTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [workday, setWorkday] = useState('8')
  const [lunch, setLunch] = useState('60')
  const [ptCompliance, setPtCompliance] = useState(false)
  const [otMultipliers, setOtMultipliers] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tenant-settings')
      if (res.ok) {
        const d = await res.json()
        if (d.default_workday_hours != null) setWorkday(String(d.default_workday_hours))
        if (d.default_lunch_break_minutes != null) setLunch(String(d.default_lunch_break_minutes))
        setPtCompliance(Boolean(d.pt_compliance))
        setOtMultipliers(Boolean(d.overtime_multipliers))
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/tenant-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_workday_hours: workday === '' ? null : Number(workday),
          default_lunch_break_minutes: lunch === '' ? null : Number(lunch),
          pt_compliance: ptCompliance,
          overtime_multipliers: otMultipliers,
        }),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.default_workday_hours != null) setWorkday(String(d.default_workday_hours))
        if (d.default_lunch_break_minutes != null) setLunch(String(d.default_lunch_break_minutes))
        setPtCompliance(Boolean(d.pt_compliance))
        setOtMultipliers(Boolean(d.overtime_multipliers))
        setMsg({ ok: true, text: 'Guardado.' })
      } else {
        const d = await res.json().catch(() => ({}))
        setMsg({ ok: false, text: d.error ?? 'Erro ao guardar.' })
      }
    } catch { setMsg({ ok: false, text: 'Erro de conexão.' }) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Empresa</div>
          <div className="page-sub">Padrões da empresa aplicados a novos funcionários.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Jornada padrão</div>
            <div className="card-sub">Pré-preenche o formulário ao adicionar um funcionário.</div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>A carregar…</div>
          ) : (
            <>
              {/* Same option sets as the new-employee form so the saved default
                  always maps to a valid choice there. */}
              <div className="form-grid-2">
                <div className="field">
                  <label>Jornada (h/dia)</label>
                  <select className="input" value={workday} onChange={e => setWorkday(e.target.value)}>
                    {[4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(h => <option key={h} value={h}>{h}h</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Pausa almoço (min)</label>
                  <select className="input" value={lunch} onChange={e => setLunch(e.target.value)}>
                    <option value="0">Sem pausa</option>
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </div>
              </div>
              <div className="alert-inline info">
                Aplica-se apenas a <strong>novos</strong> funcionários. Não altera quem já existe — para
                isso, edite cada funcionário ou use modelos de turno em Equipe.
              </div>

              <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg-subtle)', marginBottom: 10 }}>
                  Lei laboral (Portugal)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={ptCompliance} onChange={e => setPtCompliance(e.target.checked)} style={{ marginTop: 2 }} />
                    <span style={{ fontSize: 13 }}>
                      Avisos de descanso (Código do Trabalho)
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-subtle)' }}>
                        Aviso no ponto ao aproximar de 5h de trabalho consecutivo (art. 213.º) e alerta ao
                        admin quando o descanso entre jornadas fica abaixo de 11h (art. 214.º).
                      </span>
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={otMultipliers} onChange={e => setOtMultipliers(e.target.checked)} style={{ marginTop: 2 }} />
                    <span style={{ fontSize: 13 }}>
                      Acréscimos de trabalho suplementar nos ganhos
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--fg-subtle)' }}>
                        Relatórios e holerites pagam +25% na 1.ª hora extra, +37,5% nas seguintes e +50% em
                        dia de descanso ou feriado (art. 268.º).
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn primary" onClick={save} disabled={saving}>
                  {saving ? 'A guardar…' : 'Guardar'}
                </button>
                {msg && (
                  <span className={`alert-inline ${msg.ok ? 'ok' : 'err'}`} style={{ padding: '4px 10px' }}>
                    {msg.text}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
