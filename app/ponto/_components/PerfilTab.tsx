import { memo } from 'react'
import type { EmployeeProfile } from '@/lib/types'
import { useLang } from '@/lib/LangContext'
import { SunIcon, MoonIcon } from '@/app/admin/_components/icons'
import { TotpSection } from '@/app/_components/TotpSection'

function MonitorIcon({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
}

interface Props {
  user: EmployeeProfile
  theme: 'dark' | 'light'
  isSystemTheme: boolean
  selectTheme: (mode: 'dark' | 'light' | 'system') => void
  profileEmail: string
  setProfileEmail: (v: string) => void
  profileEmailSaving: boolean
  profileEmailMsg: { ok: boolean; text: string } | null
  setProfileEmailMsg: (v: null) => void
  pwdCurrent: string
  setPwdCurrent: (v: string) => void
  pwdNext: string
  setPwdNext: (v: string) => void
  pwdConfirm: string
  setPwdConfirm: (v: string) => void
  pwdSaving: boolean
  pwdMsg: { ok: boolean; text: string } | null
  setPwdMsg: (v: null) => void
  saveEmail: () => void
  changePassword: () => void
  showToast: (msg: string) => void
}

export const PerfilTab = memo(function PerfilTab({
  user, theme, isSystemTheme, selectTheme,
  profileEmail, setProfileEmail, profileEmailSaving, profileEmailMsg, setProfileEmailMsg,
  pwdCurrent, setPwdCurrent, pwdNext, setPwdNext, pwdConfirm, setPwdConfirm,
  pwdSaving, pwdMsg, setPwdMsg,
  saveEmail, changePassword, showToast,
}: Props) {
  const { t } = useLang()

  return (
    <div className="emp-card">
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 16 }}>
        {t('profile.info')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 0', borderBottom: '1px solid var(--divider)' }}>
        <div className={`avatar size-30 av-c${(user.id.charCodeAt(0) % 8) + 1}`}>{user.name.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('')}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>@{user.username}</div>
        </div>
      </div>

      {!user.lock_profile && (
        <>
          <div className="field" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('emp.email_optional')}</label>
            <input type="email" className="input" value={profileEmail} onChange={e => { setProfileEmail(e.target.value); setProfileEmailMsg(null) }} placeholder="email@empresa.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          </div>
          {profileEmailMsg && <div className={`alert-inline ${profileEmailMsg.ok ? 'ok' : 'err'}`} style={{ marginBottom: 8 }}>{profileEmailMsg.text}</div>}
          <button className="btn-emp" style={{ width: '100%', justifyContent: 'center', marginBottom: 24 }} onClick={saveEmail} disabled={profileEmailSaving}>
            {profileEmailSaving ? t('pwd.saving') : t('profile.save_email')}
          </button>
        </>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 8 }}>
        {t('profile.theme')}
      </div>
      <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, gap: 2, marginBottom: 24 }}>
        {([
          ['light', <SunIcon key="s" size={13}/>, 'profile.theme.light'],
          ['dark', <MoonIcon key="m" size={13}/>, 'profile.theme.dark'],
          ['system', <MonitorIcon key="mo" size={13}/>, 'profile.theme.system'],
        ] as const).map(([th, icon, key]) => {
          const isActive = th === 'system' ? isSystemTheme : (!isSystemTheme && theme === th)
          return (
            <button
              key={th}
              onClick={() => selectTheme(th as 'dark' | 'light' | 'system')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: isActive ? 'var(--accent)' : 'none',
                border: 'none', cursor: 'pointer', padding: '7px 4px',
                borderRadius: 6, fontSize: 12, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : 'var(--fg-muted)',
                transition: 'all 0.15s',
              }}
            >
              {icon}
              {t(key as Parameters<typeof t>[0])}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 12 }}>
        {t('profile.security')}
      </div>
      {user.lock_profile ? (
        <div className="alert-inline info" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔒</span>
          <span>{t('emp.profile_locked').charAt(0).toUpperCase() + t('emp.profile_locked').slice(1)}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="field">
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('auth.current_password')}</label>
            <input type="password" className="input" value={pwdCurrent} onChange={e => { setPwdCurrent(e.target.value); setPwdMsg(null) }} placeholder="••••••" />
          </div>
          <div className="field">
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('auth.new_password')}</label>
            <input type="password" className="input" value={pwdNext} onChange={e => { setPwdNext(e.target.value); setPwdMsg(null) }} placeholder={t('pwd.min_chars')} />
          </div>
          <div className="field">
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('auth.confirm_password')}</label>
            <input type="password" className="input" value={pwdConfirm} onChange={e => { setPwdConfirm(e.target.value); setPwdMsg(null) }} placeholder="••••••" />
          </div>
          {pwdMsg && <div className={`alert-inline ${pwdMsg.ok ? 'ok' : 'err'}`}>{pwdMsg.text}</div>}
          <button className="btn-emp primary-big" onClick={changePassword} disabled={pwdSaving || !pwdCurrent || !pwdNext}>
            {pwdSaving ? t('pwd.saving') : t('pwd.save')}
          </button>
          <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 12, marginTop: 4 }}>
            <TotpSection />
          </div>
          <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 12, marginTop: 4 }}>
            <button
              className="btn-emp"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={async () => {
                await fetch('/api/auth/revoke-other-sessions', { method: 'POST' })
                showToast(t('emp.sessions_revoked'))
              }}
            >
              {t('emp.revoke_sessions')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
