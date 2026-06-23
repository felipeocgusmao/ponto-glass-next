'use client'

import { useLang, LANG_LABELS, type Lang } from '@/lib/LangContext'
import { SunIcon, MoonIcon, LockSmIcon, IconX, IconLogout } from './icons'
import { TotpSection } from '@/app/_components/TotpSection'
import { useState, useEffect } from 'react'

const LANGS: Lang[] = ['pt-PT', 'pt-BR', 'en', 'es']

interface LoginSession {
  id: string
  ip: string
  user_agent: string
  created_at: string
  revoked_at: string | null
}

function LoginSessionsSection() {
  const [sessions, setSessions] = useState<LoginSession[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/login-sessions')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setSessions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const revoke = async (id: string) => {
    setRevoking(id)
    try {
      const res = await fetch(`/api/login-sessions?id=${id}`, { method: 'DELETE' })
      if (res.ok) setSessions(prev => prev.map(s => s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s))
    } catch { /* silent */ }
    finally { setRevoking(null) }
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>A carregar sessões…</div>
  if (!sessions.length) return <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Nenhuma sessão registada.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sessions.slice(0, 10).map(s => {
        const ua = s.user_agent.length > 40 ? s.user_agent.slice(0, 40) + '…' : s.user_agent
        const date = new Date(s.created_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontSize: 11 }}>{date} · {s.ip}</div>
              <div style={{ color: 'var(--fg-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ua}</div>
            </div>
            {s.revoked_at ? (
              <span className="chip danger" style={{ fontSize: 10, flexShrink: 0 }}>Revogada</span>
            ) : (
              <button
                className="btn ghost sm"
                style={{ fontSize: 11, flexShrink: 0 }}
                disabled={revoking === s.id}
                onClick={() => revoke(s.id)}
              >
                {revoking === s.id ? '…' : 'Revogar'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SettingsModal({
  theme,
  onToggleTheme,
  onChangePwd,
  onLogout,
  onRevokeOtherSessions,
  onClose,
}: {
  theme: string
  onToggleTheme: () => void
  onChangePwd: () => void
  onLogout: () => void
  onRevokeOtherSessions?: () => void
  onClose: () => void
}) {
  const { lang, setLang, t } = useLang()

  return (
    <div
      className="drawer-overlay"
      style={{ zIndex: 60, display: 'grid', placeItems: 'flex-start center', paddingTop: '14vh' }}
      onClick={onClose}
    >
      <div
        className="cmdk"
        style={{ maxWidth: 420, padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="drawer-head">
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Configurações</span>
          <button className="btn ghost sm icon" onClick={onClose} title={t('common.close')}>
            <IconX size={14} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Aparência */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', marginBottom: 10 }}>
              Aparência
            </div>
            <div className="seg" style={{ width: '100%' }}>
              <button
                className={theme === 'light' ? 'active' : ''}
                onClick={() => theme !== 'light' && onToggleTheme()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <SunIcon /> Claro
              </button>
              <button
                className={theme === 'dark' ? 'active' : ''}
                onClick={() => theme !== 'dark' && onToggleTheme()}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <MoonIcon /> Escuro
              </button>
            </div>
          </div>

          {/* Idioma */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', marginBottom: 10 }}>
              Idioma
            </div>
            <div className="seg" style={{ width: '100%' }}>
              {LANGS.map(l => (
                <button
                  key={l}
                  className={lang === l ? 'active' : ''}
                  onClick={() => setLang(l)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {LANG_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          {/* Segurança — 2FA */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-subtle)', marginBottom: 10 }}>
              Segurança
            </div>
            <TotpSection />
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 8 }}>Histórico de sessões</div>
              <LoginSessionsSection />
            </div>
          </div>

          {/* Divider */}
          <div className="divider" style={{ margin: 0 }} />

          {/* Account actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              className="btn ghost"
              style={{ justifyContent: 'flex-start', gap: 10 }}
              onClick={() => { onChangePwd(); onClose() }}
            >
              <LockSmIcon />
              {t('auth.change_password')}
            </button>
            {onRevokeOtherSessions && (
              <button
                className="btn ghost"
                style={{ justifyContent: 'flex-start', gap: 10 }}
                onClick={() => { onRevokeOtherSessions(); onClose() }}
              >
                <LockSmIcon />
                Terminar outras sessões
              </button>
            )}
            <button
              className="btn ghost danger"
              style={{ justifyContent: 'flex-start', gap: 10 }}
              onClick={() => { onLogout(); onClose() }}
            >
              <IconLogout size={14} />
              {t('common.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
