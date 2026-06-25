'use client'

import { useState, useCallback, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

interface WebhookConfig {
  id: string
  url: string
  active: boolean
  events: string[]
  created_at: string
}

export function IntegracoesTab() {
  const { t } = useLang()
  const [hooks, setHooks] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [newUrl, setNewUrl] = useState('')
  const [newSecret, setNewSecret] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Kiosk token state
  const [kioskToken, setKioskToken] = useState<string | null>(null)
  const [kioskLoading, setKioskLoading] = useState(true)
  const [kioskGenerating, setKioskGenerating] = useState(false)
  const [kioskErr, setKioskErr] = useState<string | null>(null)
  const [kioskCopied, setKioskCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhook-configs')
      if (res.ok) setHooks(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const loadKiosk = useCallback(async () => {
    setKioskLoading(true)
    try {
      const res = await fetch('/api/kiosk/token')
      if (res.ok) { const d = await res.json(); setKioskToken(d.token ?? null) }
    } catch { /* silent */ }
    finally { setKioskLoading(false) }
  }, [])

  const generateToken = async () => {
    setKioskGenerating(true); setKioskErr(null)
    try {
      const res = await fetch('/api/kiosk/token', { method: 'POST' })
      if (res.ok) { const d = await res.json(); setKioskToken(d.token) }
      else setKioskErr(t('kiosk.admin.err'))
    } catch { setKioskErr(t('kiosk.admin.err')) }
    finally { setKioskGenerating(false) }
  }

  const copyKioskUrl = () => {
    if (!kioskToken) return
    const url = `${window.location.origin}/kiosk?token=${kioskToken}`
    navigator.clipboard.writeText(url).then(() => {
      setKioskCopied(true)
      setTimeout(() => setKioskCopied(false), 2000)
    })
  }

  useEffect(() => { load(); loadKiosk() }, [load, loadKiosk])

  const add = async () => {
    if (!newUrl.startsWith('https://')) { setMsg({ ok: false, text: t('integ.url_https') }); return }
    setAdding(true); setMsg(null)
    try {
      const res = await fetch('/api/webhook-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, secret: newSecret || null, events: ['punch'] }),
      })
      if (res.ok) {
        const d = await res.json()
        setHooks(prev => [d, ...prev])
        setNewUrl(''); setNewSecret('')
        setMsg({ ok: true, text: t('integ.added') })
      } else {
        const d = await res.json()
        setMsg({ ok: false, text: d.error ?? t('integ.err.add') })
      }
    } catch { setMsg({ ok: false, text: t('integ.err.connect') }) }
    finally { setAdding(false) }
  }

  const toggle = async (h: WebhookConfig) => {
    const res = await fetch('/api/webhook-configs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: h.id, active: !h.active }),
    })
    if (res.ok) {
      const d = await res.json()
      setHooks(prev => prev.map(wh => wh.id === d.id ? d : wh))
    }
  }

  const remove = async (id: string) => {
    if (!confirm(t('integ.del_confirm'))) return
    const res = await fetch(`/api/webhook-configs?id=${id}`, { method: 'DELETE' })
    if (res.ok) setHooks(prev => prev.filter(h => h.id !== id))
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{t('tab.integracoes')}</div>
          <div className="page-sub">{t('integ.subtitle')}</div>
        </div>
      </div>

      {/* Add form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>{t('integ.add_title')}</div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t('integ.url_label')} <span style={{ color: 'var(--danger-fg)' }}>*</span></label>
            <input
              type="url"
              className="input"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/…"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t('integ.secret_label')}</label>
            <input
              type="password"
              className="input"
              value={newSecret}
              onChange={e => setNewSecret(e.target.value)}
              placeholder={t('integ.secret_ph')}
            />
          </div>
          {msg && <div className={`alert-inline ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
          <div>
            <button className="btn primary" onClick={add} disabled={adding || !newUrl}>
              {adding ? t('integ.adding') : t('integ.add_btn')}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
            {t('integ.hint')}
          </div>
        </div>
      </div>

      {/* Kiosk token */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>{t('kiosk.admin.title')}</div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{t('kiosk.admin.desc')}</div>
          {kioskLoading ? (
            <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{t('common.loading')}</div>
          ) : kioskToken ? (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>{t('kiosk.admin.link_label')}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontSize: 12, padding: '6px 10px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', wordBreak: 'break-all', flex: 1 }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/kiosk?token=${kioskToken}` : `/kiosk?token=${kioskToken}`}
                  </code>
                  <button className="btn ghost sm" onClick={copyKioskUrl}>
                    {kioskCopied ? t('kiosk.admin.copied') : '📋'}
                  </button>
                </div>
              </div>
              <div>
                <button className="btn ghost sm" onClick={generateToken} disabled={kioskGenerating}>
                  {kioskGenerating ? t('kiosk.admin.generating') : t('kiosk.admin.regenerate')}
                </button>
              </div>
            </>
          ) : (
            <div>
              <button className="btn primary" onClick={generateToken} disabled={kioskGenerating}>
                {kioskGenerating ? t('kiosk.admin.generating') : t('kiosk.admin.generate')}
              </button>
            </div>
          )}
          {kioskErr && <div className="alert-inline err">{kioskErr}</div>}
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
          {t('integ.list_title')} {hooks.length > 0 && <span className="chip" style={{ fontSize: 11, marginLeft: 6 }}>{hooks.length}</span>}
        </div>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--fg-muted)', fontSize: 13 }}>{t('common.loading')}</div>
        ) : hooks.length === 0 ? (
          <div style={{ padding: 20 }}>
            <div className="empty">
              <div className="title">{t('integ.empty_title')}</div>
              <div className="desc">{t('integ.empty_desc')}</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {hooks.map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', wordBreak: 'break-all', opacity: h.active ? 1 : 0.5 }}>{h.url}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {t('integ.events_label')} {h.events?.join(', ') || 'punch'} · {t('integ.created_label')} {new Date(h.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className={`chip ${h.active ? 'success' : ''}`} style={{ fontSize: 10 }}>{h.active ? t('integ.status.active') : t('integ.status.paused')}</span>
                  <button className="btn ghost sm" onClick={() => toggle(h)}>{h.active ? t('integ.pause') : t('integ.activate')}</button>
                  <button className="btn ghost sm danger" onClick={() => remove(h.id)}>{t('common.delete')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
