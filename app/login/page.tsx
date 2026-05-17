'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Erro ao fazer login')
      setLoading(false)
      return
    }

    router.push(data.role === 'admin' ? '/admin' : '/ponto')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="glass w-full max-w-sm p-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🕰️</div>
          <h1 className="brand-name">PontoGlass</h1>
          <span className="brand-sub">Controle de ponto digital</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Seu usuário"
              className="glass-input"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="input-label">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="glass-input"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="alert-error">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="btn-glass w-full mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar →'}
          </button>
        </form>

        <p className="text-center mt-6 text-xs text-white/25">
          Acesso padrão:{' '}
          <code className="text-white/45">admin</code> /{' '}
          <code className="text-white/45">admin123</code>
        </p>
      </div>
    </main>
  )
}
