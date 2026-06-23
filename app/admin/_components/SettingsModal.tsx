'use client'

import { useLang, LANG_LABELS, type Lang } from '@/lib/LangContext'
import { SunIcon, MoonIcon, LockSmIcon, IconX, IconLogout } from './icons'
import { TotpSection } from '@/app/_components/TotpSection'
import { useState, useEffect } from 'react'

const LANGS: Lang[] = ['pt-PT', 'pt-BR', 'en', 'es']

const LANG_TO_LOCALE: Record<Lang, string> = {
  'pt-PT': 'pt-PT',
  'pt-BR': 'pt-BR',
  'en':    'en-GB',
  'es':    'es-ES',
}

interface LoginSession {
  id: string
  ip: string
  user_agent: string
  created_at: string
  revoked_at: string | null
}

function LoginSessionsSection() {
  const { lang, t } = useLang()
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

  if (loading) return <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('settings.sessions_loading')}</div>
  if (!sessions.length) return <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{t('settings.sessions_none')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sessions.slice(0, 10).map(s => {
        const ua = s.user_agent.length > 44 ? s.user_agent.slice(0, 44) + '…' : s.user_agent
        const date = new Date(s.created_at).toLocaleString(LANG_TO_LOCALE[lang], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontSize: 10.5 }}>{date} · {s.ip}</div>
              <div style={{ color: 'var(--fg-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{ua}</div>
            </div>
            {s.revoked_at ? (
              <span className="chip danger" style={{ fontSize: 10, flexShrink: 0 }}>{t('settings.revoked')}</span>
            ) : (
              <button className="btn ghost sm" style={{ fontSize: 11, flexShrink: 0 }} disabled={revoking === s.id} onClick={() => revoke(s.id)}>
                {revoking === s.id ? '…' : t('settings.revoke')}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

const ACCENT_OPTIONS = [
  { id: 'indigo',  light: '#5e6ad2', dark: '#7c8cf8',  label: 'Índigo'  },
  { id: 'violet',  light: '#7c3aed', dark: '#a78bfa',  label: 'Violeta' },
  { id: 'cyan',    light: '#0891b2', dark: '#22d3ee',  label: 'Ciano'   },
  { id: 'emerald', light: '#059669', dark: '#34d399',  label: 'Verde'   },
  { id: 'teal',    light: '#0d9488', dark: '#2dd4bf',  label: 'Teal'    },
  { id: 'amber',   light: '#d97706', dark: '#f59e0b',  label: 'Âmbar'   },
  { id: 'orange',  light: '#ea580c', dark: '#fb923c',  label: 'Laranja' },
  { id: 'rose',    light: '#e11d48', dark: '#fb7185',  label: 'Rosa'    },
  { id: 'slate',   light: '#475569', dark: '#94a3b8',  label: 'Cinza'   },
]

const FONT_OPTIONS = [
  { id: 'inter',     label: 'Linear',    subKey: 'settings.font.flat'      },
  { id: 'mono',      label: 'Workbench', subKey: 'settings.font.mono'      },
  { id: 'editorial', label: 'Editorial', subKey: 'settings.font.editorial' },
] as const

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--fg-subtle)', marginBottom: 10 }}>
    {children}
  </div>
)

export default function SettingsModal({
  theme, accent, font,
  onToggleTheme, onChangeAccent, onChangeFont,
  onChangePwd, onLogout, onRevokeOtherSessions, onClose,
}: {
  theme: string
  accent: string
  font: string
  onToggleTheme: () => void
  onChangeAccent: (a: string) => void
  onChangeFont: (f: string) => void
  onChangePwd: () => void
  onLogout: () => void
  onRevokeOtherSessions?: () => void
  onClose: () => void
}) {
  const { lang, setLang, t } = useLang()

  return (
    <div
      className="drawer-overlay"
      style={{ zIndex: 60, display: 'grid', placeItems: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        className="cmdk"
        style={{ maxWidth: 480, width: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: 0, borderRadius: 'var(--r-xl)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="drawer-head" style={{ position: 'sticky', top: 0, zIndex: 1, background: 'inherit', backdropFilter: 'inherit', WebkitBackdropFilter: 'inherit' }}>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{t('settings.title')}</span>
          <button className="btn ghost sm icon" onClick={onClose} title={t('common.close')}>
            <IconX size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Tema + Idioma side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <SectionLabel>{t('settings.theme')}</SectionLabel>
              <div className="seg" style={{ width: '100%' }}>
                <button
                  className={theme === 'light' ? 'active' : ''}
                  onClick={() => theme !== 'light' && onToggleTheme()}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                >
                  <SunIcon /> {t('profile.theme.light')}
                </button>
                <button
                  className={theme === 'dark' ? 'active' : ''}
                  onClick={() => theme !== 'dark' && onToggleTheme()}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                >
                  <MoonIcon /> {t('profile.theme.dark')}
                </button>
              </div>
            </div>

            <div>
              <SectionLabel>{t('settings.language')}</SectionLabel>
              <div className="seg" style={{ width: '100%' }}>
                {LANGS.map(l => (
                  <button
                    key={l}
                    className={lang === l ? 'active' : ''}
                    onClick={() => setLang(l)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5 }}
                  >
                    {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Destaque */}
          <div>
            <SectionLabel>{t('settings.accent')}</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ACCENT_OPTIONS.map(opt => {
                const color = theme === 'dark' ? opt.dark : opt.light
                const isActive = accent === opt.id
                return (
                  <button
                    key={opt.id}
                    title={opt.label}
                    onClick={() => onChangeAccent(opt.id)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: color, border: 'none', cursor: 'pointer',
                      outline: isActive ? `3px solid ${color}` : '3px solid transparent',
                      outlineOffset: 2,
                      boxShadow: isActive ? `0 0 0 1px var(--border), 0 2px 8px ${color}55` : '0 1px 3px rgba(0,0,0,0.15)',
                      transform: isActive ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.15s, box-shadow 0.15s, outline 0.15s',
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>
          </div>

          {/* Fonte */}
          <div>
            <SectionLabel>{t('settings.font')}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {FONT_OPTIONS.map(opt => {
                const isActive = font === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => onChangeFont(opt.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--r-md)',
                      border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                      background: isActive ? 'var(--accent-soft)' : 'transparent',
                      color: isActive ? 'var(--accent-soft-fg)' : 'var(--fg)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{opt.label}</div>
                    <div style={{ fontSize: 10.5, color: isActive ? 'var(--accent-soft-fg)' : 'var(--fg-muted)', marginTop: 2 }}>{t(opt.subKey)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Segurança */}
          <div>
            <SectionLabel>{t('profile.security')}</SectionLabel>
            <TotpSection />
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 8 }}>{t('settings.sessions')}</div>
              <LoginSessionsSection />
            </div>
          </div>

          {/* Divider */}
          <div className="divider" style={{ margin: 0 }} />

          {/* Account actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="btn ghost" style={{ justifyContent: 'flex-start', gap: 10 }} onClick={() => { onChangePwd(); onClose() }}>
              <LockSmIcon />
              {t('auth.change_password')}
            </button>
            {onRevokeOtherSessions && (
              <button className="btn ghost" style={{ justifyContent: 'flex-start', gap: 10 }} onClick={() => { onRevokeOtherSessions(); onClose() }}>
                <LockSmIcon />
                {t('settings.revoke_others')}
              </button>
            )}
            <button className="btn ghost danger" style={{ justifyContent: 'flex-start', gap: 10 }} onClick={() => { onLogout(); onClose() }}>
              <IconLogout size={14} />
              {t('common.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
