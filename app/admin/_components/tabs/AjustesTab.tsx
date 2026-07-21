'use client'

import { useState, useEffect, useCallback } from 'react'

// #292 — one heartbeat entry per cron (lib/cronHealth.ts); maxAgeHours is a
// generous multiple of each cron's expected cadence (vercel.json + the GitHub
// Actions workflow) so a genuinely stuck secret/workflow reads red without
// false alarms from ordinary scheduling jitter.
const CRON_HEALTH: { key: string; label: string; maxAgeHours: number }[] = [
  { key: 'entry-reminder',      label: 'Lembrete de entrada',        maxAgeHours: 20 },
  { key: 'punch-out-reminder',  label: 'Lembrete de saída',          maxAgeHours: 20 },
  { key: 'absence-check',       label: 'Verificação de ausências',   maxAgeHours: 30 },
  { key: 'missing-exit',        label: 'Saídas em falta',            maxAgeHours: 30 },
  { key: 'alert-check',         label: 'Alertas e conformidade',     maxAgeHours: 30 },
  { key: 'hour-bank-cap',       label: 'Cap do banco de horas',      maxAgeHours: 24 * 33 },
]

function cronTimeAgo(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 2) return 'agora'
  if (m < 60) return `${m}m atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

function CronHealthCard() {
  const [lastRun, setLastRun] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    fetch('/api/cron-health')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setLastRun(d) })
      .catch(() => {})
  }, [])

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-head">
        <div>
          <div className="card-title">Lembretes automáticos</div>
          <div className="card-sub">Última execução de cada verificação (entrada, saída, ausências, alertas).</div>
        </div>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lastRun === null ? (
          <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>A carregar…</div>
        ) : CRON_HEALTH.map(({ key, label, maxAgeHours }) => {
          const iso = lastRun[key] ?? null
          const ageHours = iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : Infinity
          const healthy = ageHours <= maxAgeHours
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: healthy ? 'var(--success-fg)' : 'var(--danger-fg)',
              }} />
              <span style={{ flex: 1 }}>{label}</span>
              <span className="muted" style={{ fontSize: 12 }}>{cronTimeAgo(iso)}</span>
            </div>
          )
        })}
        <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 4 }}>
          Os lembretes correm via GitHub Actions (plano Hobby do Vercel não permite crons intradiários).
          Um ponto vermelho persistente costuma indicar o secret <code>CRON_SECRET</code> desalinhado ou o
          workflow pausado no repositório.
        </div>
      </div>
    </div>
  )
}

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
  const [annualLimit, setAnnualLimit] = useState('') // '' = off, else minutes as string

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
        setAnnualLimit(d.annual_overtime_limit != null ? String(d.annual_overtime_limit) : '')
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
          annual_overtime_limit: annualLimit === '' ? null : Number(annualLimit),
        }),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.default_workday_hours != null) setWorkday(String(d.default_workday_hours))
        if (d.default_lunch_break_minutes != null) setLunch(String(d.default_lunch_break_minutes))
        setPtCompliance(Boolean(d.pt_compliance))
        setOtMultipliers(Boolean(d.overtime_multipliers))
        setAnnualLimit(d.annual_overtime_limit != null ? String(d.annual_overtime_limit) : '')
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
                  <div className="field" style={{ marginTop: 4 }}>
                    <label>Limite anual de trabalho suplementar</label>
                    <select className="input" value={annualLimit} onChange={e => setAnnualLimit(e.target.value)}>
                      <option value="">Desligado</option>
                      <option value="10500">175h/ano (micro/pequenas empresas)</option>
                      <option value="9000">150h/ano (médias/grandes empresas)</option>
                    </select>
                    <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 3 }}>
                      Acompanha o suplementar acumulado no ano civil na aba Banco de Horas e avisa o
                      admin ao atingir 80% e 100% do limite (art. 228.º CT).
                    </div>
                  </div>
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

      <CronHealthCard />
    </>
  )
}
