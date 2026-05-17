'use client'

import { useState } from 'react'

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-base">🔑  Trocar Senha</h2>
          <button onClick={onClose} className="btn-logout">✕</button>
        </div>

        {ok ? (
          <div className="alert-success">✅ Senha alterada com sucesso!</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="input-label">Senha atual</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="glass-input"
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label className="input-label">Nova senha</label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Mín. 6 caracteres"
                className="glass-input"
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="input-label">Confirmar nova senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="glass-input"
                autoComplete="new-password"
                required
              />
            </div>
            {err && <div className="alert-error">{err}</div>}
            <button type="submit" disabled={loading} className="btn-glass w-full mt-1">
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
