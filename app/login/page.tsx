'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

function EyeOffIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
function EyeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function ArrowRightIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}
function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'pg-spin 0.7s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" fill="none"/>
      <path d="M21 12 a9 9 0 0 0 -9 -9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

function BrandPanel() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const secProgress = now.getSeconds() / 60

  return (
    <div className="login-brand-side">
      <div className="login-brand-bg" />
      <div className="login-brand-grid" />
      <div className="login-brand-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sb-logo" style={{ width: 30, height: 30, borderRadius: 8 }} role="img" aria-label="PontoGlass" />
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.95)' }}>PontoGlass</span>
        </div>
      </div>

      <div className="login-brand-center">
        <div className="login-clock-wrap">
          <svg viewBox="-100 -100 200 200" className="login-clock-ring" aria-hidden="true">
            <circle cx="0" cy="0" r="90" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1"/>
            <circle cx="0" cy="0" r="90" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"
              strokeDasharray={`${secProgress * 565.48} 565.48`} strokeDashoffset="0"
              transform="rotate(-90)" strokeLinecap="round"/>
            {Array.from({ length: 60 }).map((_, i) => {
              const a = (i / 60) * Math.PI * 2
              const isHour = i % 5 === 0
              return (
                <line key={i}
                  x1={Math.cos(a) * (isHour ? 78 : 84)} y1={Math.sin(a) * (isHour ? 78 : 84)}
                  x2={Math.cos(a) * 88} y2={Math.sin(a) * 88}
                  stroke={isHour ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}
                  strokeWidth={isHour ? 1.5 : 0.5}
                />
              )
            })}
          </svg>
          <div className="login-clock-time tnum mono">
            <span>{hh}</span>
            <span className="login-clock-sep">:</span>
            <span>{mm}</span>
            <span className="login-clock-sec">:{ss}</span>
          </div>
        </div>

        <div className="login-brand-tagline">
          o tempo, finalmente,<br />tem forma.
        </div>

        <div className="login-brand-meta">
          <span style={{ textTransform: 'capitalize' }}>
            {now.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
          <span className="dot-sep">·</span>
          <span>Lisboa · UTC+1</span>
        </div>
      </div>

      <div className="login-brand-bottom">
        <div className="login-brand-stat"><div className="num tnum">∞</div><div className="lbl">funcionários</div></div>
        <div className="login-brand-stat"><div className="num tnum">99.9%</div><div className="lbl">uptime</div></div>
        <div className="login-brand-stat"><div className="num tnum">8h</div><div className="lbl">sessão</div></div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { t } = useLang()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotUsername, setForgotUsername] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotDone, setForgotDone] = useState(false)
  const pwdRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: forgotUsername }),
    })
    setForgotLoading(false)
    setForgotDone(true)
  }

  useEffect(() => {
    const saved = localStorage.getItem('pg.remembered_user') ?? ''
    if (saved) { setUsername(saved); setRemember(true) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) { setError(t('login.fill_fields')); return }
    setLoading(true); setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('auth.invalid'))
      setLoading(false)
      return
    }

    if (remember) localStorage.setItem('pg.remembered_user', username.trim())
    else localStorage.removeItem('pg.remembered_user')

    router.push(data.role === 'admin' || data.role === 'manager' ? '/admin' : '/ponto')
  }

  return (
    <div className="login-shell-split">
      <BrandPanel />

      <div className="login-form-side">
        <div className="login-form-card">
          <div className="login-mobile-brand">
            <div className="sb-logo" style={{ width: 28, height: 28, borderRadius: 7 }} role="img" aria-label="PontoGlass" />
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>PontoGlass</span>
          </div>

          <div className="login-heading">
            <div className="login-title">{t('login.welcome')}</div>
            <div className="login-sub">{t('login.subtitle')}</div>
          </div>

          {forgotMode ? (
            <div className="login-form">
              {forgotDone ? (
                <>
                  <div className="alert-inline ok" style={{ marginBottom: 8 }}>
                    Se o username existir e tiver email associado, receberás um link em breve.
                  </div>
                  <button onClick={() => { setForgotMode(false); setForgotDone(false); setForgotUsername('') }}
                    className="btn ghost" style={{ width: '100%', justifyContent: 'center' }}>
                    ← Voltar ao login
                  </button>
                </>
              ) : (
                <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', marginBottom: 4 }}>Recuperar acesso</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Insere o teu username e receberás um email com o link para redefinir a senha.</div>
                  </div>
                  <div className="field">
                    <label htmlFor="forgot-username">{t('auth.username')}</label>
                    <input id="forgot-username" className="input" placeholder="seu.usuario" value={forgotUsername}
                      onChange={e => setForgotUsername(e.target.value)} autoFocus
                      autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{ height: 38 }} required />
                  </div>
                  <button type="submit" disabled={forgotLoading} className="btn primary"
                    style={{ width: '100%', justifyContent: 'center', height: 40 }}>
                    {forgotLoading ? <><SpinnerIcon /> A enviar…</> : 'Enviar link de recuperação'}
                  </button>
                  <button type="button" onClick={() => setForgotMode(false)} className="btn ghost"
                    style={{ width: '100%', justifyContent: 'center' }}>
                    ← Voltar ao login
                  </button>
                </form>
              )}
            </div>
          ) : (

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field">
              <label htmlFor="login-username">{t('auth.username')}</label>
              <input id="login-username" className="input" placeholder="seu.usuario" value={username}
                onChange={e => setUsername(e.target.value)} disabled={loading}
                autoFocus={!username} autoComplete="username"
                autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{ height: 38 }}/>
            </div>

            <div className="field">
              <label htmlFor="login-password">{t('auth.password')}</label>
              <div className="login-pwd-wrap">
                <input id="login-password" ref={pwdRef} className="input" type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  disabled={loading} autoFocus={!!username} autoComplete="current-password"
                  style={{ height: 38, paddingRight: 38, width: '100%' }}/>
                <button type="button" className="login-pwd-toggle"
                  onClick={() => { setShowPwd(s => !s); pwdRef.current?.focus() }}
                  aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-controls="login-password"
                  tabIndex={-1}>
                  {showPwd ? <EyeIcon size={14} aria-hidden /> : <EyeOffIcon size={14} aria-hidden />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-alert err">
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}/>
                {error}
              </div>
            )}

            <button type="submit" className="btn primary lg" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', height: 40 }}>
              {loading ? <><SpinnerIcon /> {t('auth.logging_in')}</> : <>{t('auth.login')} <ArrowRightIcon size={13}/></>}
            </button>

            <label className="login-remember">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/>
              <span>{t('login.remember')}</span>
            </label>
            <button type="button" onClick={() => { setForgotMode(true); setForgotUsername(username) }}
              style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer', padding: 0, textAlign: 'left', textDecoration: 'underline' }}>
              Esqueci a senha
            </button>
          </form>
          )}

          <div className="login-footer">
            <span className="login-secure"><LockIcon size={11}/> {t('login.secure')}</span>
            <span className="muted" style={{ fontSize: 11 }}>v0.6.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
