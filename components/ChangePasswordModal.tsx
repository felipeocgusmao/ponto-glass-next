'use client'

import { useState } from 'react'

function LockIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function XIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (next !== confirm) { setErr('As senhas não coincidem.'); return }
    setLoading(true)
    const res = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error); setLoading(false); return }
    setOk(true)
    setLoading(false)
    setTimeout(onClose, 1800)
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}>
            <LockIcon /> Trocar Senha
          </div>
          <button onClick={onClose} className="btn ghost sm icon"><XIcon /></button>
        </div>

        {ok ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0', textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--success-soft)', color: 'var(--success-fg)', display: 'grid', placeItems: 'center' }}>
              <CheckIcon />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--success-fg)' }}>Senha alterada com sucesso!</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label>Senha atual</label>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
                className="input" autoComplete="current-password" required style={{ height: 34, width: '100%' }}/>
            </div>
            <div className="field">
              <label>Nova senha</label>
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
                placeholder="Mín. 6 caracteres" className="input" autoComplete="new-password"
                required style={{ height: 34, width: '100%' }}/>
            </div>
            <div className="field">
              <label>Confirmar nova senha</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="input" autoComplete="new-password" required style={{ height: 34, width: '100%' }}/>
            </div>
            {err && <div className="login-alert err">{err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={onClose} className="btn">Cancelar</button>
              <button type="submit" disabled={loading} className="btn primary">
                {loading ? 'Salvando…' : 'Salvar senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
