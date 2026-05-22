'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres.'); return }
    setLoading(true); setError('')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: password }),
    })
    const data = await res.json()
    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } else {
      setError(data.error ?? 'Erro ao redefinir senha.')
      setLoading(false)
    }
  }

  if (!token) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 360 }}>
      <div style={{ color: 'var(--danger-fg)', marginBottom: 16 }}>Link inválido. Solicita um novo no login.</div>
      <button onClick={() => router.push('/login')} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
        Voltar ao login
      </button>
    </div>
  )

  if (done) return (
    <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 360 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <div style={{ color: 'var(--success-fg)', fontWeight: 600, marginBottom: 8 }}>Senha redefinida com sucesso!</div>
      <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>A redirecionar para o login…</div>
    </div>
  )

  return (
    <div className="card" style={{ padding: 32, maxWidth: 360, width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>Nova senha</div>
        <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>Define uma nova senha para a tua conta PontoGlass.</div>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="field">
          <label>Nova senha</label>
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} className="input" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Mín. 6 caracteres"
              style={{ paddingRight: 38 }} autoFocus required />
            <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 16, padding: 0 }}>
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>
        </div>
        <div className="field">
          <label>Confirmar senha</label>
          <input type={showPwd ? 'text' : 'password'} className="input" value={confirm}
            onChange={e => setConfirm(e.target.value)} placeholder="Repete a senha" required />
        </div>
        {error && <div className="alert-inline err">{error}</div>}
        <button type="submit" disabled={loading} className="btn primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
          {loading ? 'A guardar…' : 'Guardar nova senha'}
        </button>
        <button type="button" onClick={() => router.push('/login')} className="btn ghost"
          style={{ width: '100%', justifyContent: 'center' }}>
          Cancelar
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 16 }}>
      <Suspense fallback={<div className="tnum mono" style={{ fontSize: 32, color: 'var(--fg-dim)' }}>…</div>}>
        <ResetForm />
      </Suspense>
    </div>
  )
}
