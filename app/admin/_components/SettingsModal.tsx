'use client'

import { useLang, LANG_LABELS, type Lang } from '@/lib/LangContext'
import { SunIcon, MoonIcon, LockSmIcon, IconX, IconLogout } from './icons'
import { TotpSection } from '@/app/_components/TotpSection'

const LANGS: Lang[] = ['pt-PT', 'pt-BR', 'en', 'es']

export default function SettingsModal({
  theme,
  onToggleTheme,
  onChangePwd,
  onLogout,
  onClose,
}: {
  theme: string
  onToggleTheme: () => void
  onChangePwd: () => void
  onLogout: () => void
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
