'use client'

import { useState, useCallback, useEffect } from 'react'

interface WebhookConfig {
  id: string
  url: string
  active: boolean
  events: string[]
  created_at: string
}

export function IntegracoesTab() {
  const [hooks, setHooks] = useState<WebhookConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [newUrl, setNewUrl] = useState('')
  const [newSecret, setNewSecret] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhook-configs')
      if (res.ok) setHooks(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!newUrl.startsWith('https://')) { setMsg({ ok: false, text: 'A URL deve começar com https://' }); return }
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
        setMsg({ ok: true, text: 'Webhook adicionado.' })
      } else {
        const d = await res.json()
        setMsg({ ok: false, text: d.error ?? 'Erro ao adicionar.' })
      }
    } catch { setMsg({ ok: false, text: 'Erro de conexão.' }) }
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
    if (!confirm('Eliminar este webhook?')) return
    const res = await fetch(`/api/webhook-configs?id=${id}`, { method: 'DELETE' })
    if (res.ok) setHooks(prev => prev.filter(h => h.id !== id))
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Integrações</div>
          <div className="page-sub">Webhooks de saída — receba eventos de ponto em sistemas externos</div>
        </div>
      </div>

      {/* Add form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>Adicionar webhook</div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>URL do endpoint <span style={{ color: 'var(--danger-fg)' }}>*</span></label>
            <input
              type="url"
              className="input"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/…"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Segredo HMAC (opcional)</label>
            <input
              type="password"
              className="input"
              value={newSecret}
              onChange={e => setNewSecret(e.target.value)}
              placeholder="Chave secreta para assinar os payloads"
            />
          </div>
          {msg && <div className={`alert-inline ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
          <div>
            <button className="btn primary" onClick={add} disabled={adding || !newUrl}>
              {adding ? 'A adicionar…' : 'Adicionar'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
            O PontoGlass envia um <code>POST</code> com <code>Content-Type: application/json</code> para este URL sempre que um ponto é registado.
            Se definir um segredo, o payload vem assinado com <code>X-PontoGlass-Signature: sha256=…</code>.
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
          Webhooks configurados {hooks.length > 0 && <span className="chip" style={{ fontSize: 11, marginLeft: 6 }}>{hooks.length}</span>}
        </div>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--fg-muted)', fontSize: 13 }}>A carregar…</div>
        ) : hooks.length === 0 ? (
          <div style={{ padding: 20 }}>
            <div className="empty">
              <div className="title">Nenhum webhook configurado</div>
              <div className="desc">Adicione um endpoint acima para integrar com Zapier, Make, ERPs e outros sistemas.</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {hooks.map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-mono)', wordBreak: 'break-all', opacity: h.active ? 1 : 0.5 }}>{h.url}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                    Eventos: {h.events?.join(', ') || 'punch'} · Criado em {new Date(h.created_at).toLocaleDateString('pt-PT')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className={`chip ${h.active ? 'success' : ''}`} style={{ fontSize: 10 }}>{h.active ? 'ativo' : 'pausado'}</span>
                  <button className="btn ghost sm" onClick={() => toggle(h)}>{h.active ? 'Pausar' : 'Ativar'}</button>
                  <button className="btn ghost sm danger" onClick={() => remove(h.id)}>Remover</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
