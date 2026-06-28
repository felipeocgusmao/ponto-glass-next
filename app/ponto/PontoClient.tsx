'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PunchRecord, EmployeeProfile } from '@/lib/types'
import EmpSidebar from './_components/EmpSidebar'
import { PontoTab } from './_components/PontoTab'
import { HistoricoTab } from './_components/HistoricoTab'
import { BancoTab } from './_components/BancoTab'
import { CorrecoesTab } from './_components/CorrecoesTab'
import { PerfilTab } from './_components/PerfilTab'
import { businessDate, empColor, avatarInitials, getWorkState, calcLiveMin } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'
import { getQueue, enqueue, flushQueue } from '@/lib/punchQueue'
import { apiFetch } from '@/lib/apiFetch'
import { ErrorBoundary } from '@/app/_components/ErrorBoundary'
import SettingsModal from '@/app/admin/_components/SettingsModal'
import { usePunchData } from './_lib/usePunchData'
import { useThemeSettings } from '@/lib/hooks/useThemeSettings'
import { usePushNotifications } from './_lib/usePushNotifications'
import { useGeofence } from './_lib/useGeofence'
import { useEmployeeHistory } from './_lib/useEmployeeHistory'
import { useBankData } from './_lib/useBankData'
import { useCorrectionRequests } from './_lib/useCorrectionRequests'

type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'
type Tab = 'ponto' | 'historico' | 'banco' | 'correcoes' | 'perfil'

async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  const { getPosition } = await import('@/lib/native')
  return getPosition(8000)
}

// Topbar breadcrumb labels per tab (mirrors the admin panel's title chip).
const TAB_TITLES: Record<Tab, 'tab.meu_ponto' | 'tab.registros' | 'tab.banco' | 'tab.correcoes' | 'tab.perfil'> = {
  ponto:     'tab.meu_ponto',
  historico: 'tab.registros',
  banco:     'tab.banco',
  correcoes: 'tab.correcoes',
  perfil:    'tab.perfil',
}


function StopIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> }
function RefreshIcon({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg> }

interface PontoClientProps {
  initialUser: EmployeeProfile
  initialRecords: PunchRecord[]
}

export function PontoClient({ initialUser, initialRecords }: PontoClientProps) {
  const { t } = useLang()
  const { theme, isSystemTheme, accent, font, selectTheme, toggleTheme, changeAccent, changeFont, syncFromServer } = useThemeSettings({
    onThemeChange: (mode) => {
      fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: mode }) }).catch(() => {})
    },
  })
  const { user, setUser, records, setRecords, fetchError, setFetchError, loadUser, loadRecords } = usePunchData({
    onUserTheme: syncFromServer,
    initialUser,
    initialRecords,
  })
  const [showSettings, setShowSettings] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const [punching, setPunching] = useState(false)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<Tab>('ponto')
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // history tab — state and data managed by dedicated hook

  // profile tab state
  const [profileEmail, setProfileEmail] = useState('')
  const [profileEmailSaving, setProfileEmailSaving] = useState(false)
  const [profileEmailMsg, setProfileEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNext, setPwdNext] = useState('')
  const [pwdConfirm, setPwdConfirm] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // offline queue
  const [isOnline, setIsOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)

  // punch-out confirmation
  const [confirmingOut, setConfirmingOut] = useState(false)

  // persistent inline error after a failed punch (clears on next success)
  const [punchError, setPunchError] = useState<string | null>(null)

  // auto-exit banner
  const [autoExitBanner, setAutoExitBanner] = useState<string | null>(null)

  // reminder
  const [reminderDismissed, setReminderDismissed] = useState(false)

  const router = useRouter()
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pullStartY = useRef(0)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  // Derived from records — memoized so the sort+filter doesn't run on every 1s clock tick
  const myRecsMemo = useMemo(
    () => records.filter(r => r.employee_id === user?.id),
    [records, user?.id],
  )
  const { state: stateMemo, since: sinceMemo } = useMemo(() => getWorkState(myRecsMemo), [myRecsMemo])

  // History tab — must be before early returns (rules of hooks)
  const lunchBreakMin = user?.lunch_break_minutes ?? 60
  const {
    historyRecs, historyLoading, historyLoaded,
    historyExceptionsFull,
    byDay, sortedDays, totalMonthMin, absentDays,
    histYM, histMonthLabel, isCurrentHistMonth,
    calendarView, setCalendarView,
    goPrevMonth, goNextMonth,
    loadHistory, invalidateHistory,
  } = useEmployeeHistory({ lunchBreakMin })

  // Bank + compensation hook (banco tab)
  const initDate = businessDate()
  const initNow = new Date()
  const initTime = `${String(initNow.getHours()).padStart(2, '0')}:${String(initNow.getMinutes()).padStart(2, '0')}`
  const {
    bankBalance, bankLoading,
    compList, compLoaded, compLoading,
    compDate, setCompDate,
    compHours, setCompHours,
    compReason, setCompReason,
    compSubmitting, compMsg,
    loadBank, loadCompensation, submitCompensation,
  } = useBankData({ t: t as (key: string) => string, initialDate: initDate })

  // Correction requests hook (correcoes tab)
  const {
    corrList, corrLoaded, corrLoading, corrBadge,
    corrDate, setCorrDate,
    corrTime, setCorrTime,
    corrType, setCorrType,
    corrReason, setCorrReason,
    corrSubmitting, corrMsg,
    loadCorrections, submitCorrection, markCorrectionsSeen,
  } = useCorrectionRequests({ t: t as (key: string) => string, initialDate: initDate, initialTime: initTime })

  // Extracted hooks
  const { geoDistance } = useGeofence({
    user, records, loadRecords,
    onAutoExit: (msg) => setAutoExitBanner(msg),
  })
  usePushNotifications({ user, records, t: t as (key: string) => string })

  // Data is seeded from the Server Component (no initial fetch). We only sync the
  // server-stored theme once on mount so the UI matches the saved preference.
  useEffect(() => {
    if (initialUser.theme) syncFromServer(initialUser.theme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setQueueCount(getQueue().length)
    const handleOnline = async () => {
      setIsOnline(true)
      const result = await flushQueue()
      setQueueCount(getQueue().length)
      if (result.synced > 0) {
        showToast(t('ponto.queue_synced').replace('{n}', String(result.synced)))
        loadRecords()
      }
      if (result.dropped > 0)
        showToast(t('ponto.queue_dropped').replace('{n}', String(result.dropped)))
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_PUNCH_QUEUE') handleOnline()
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
    // showToast is intentionally omitted: it only touches stable setState/refs,
    // so a stale identity is harmless and listing it would re-register the
    // listeners on every render.
  }, [t, loadRecords]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (user) setProfileEmail(user.email ?? '') }, [user])

  useEffect(() => {
    setNow(new Date())
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

  // Pull-to-refresh: swipe down from top of the page element
  useEffect(() => {
    const el = pageRef.current
    if (!el) return
    const THRESHOLD = 72
    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return
      pullStartY.current = e.touches[0].clientY
      setIsPulling(true)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling && el.scrollTop > 0) return
      const dy = e.touches[0].clientY - pullStartY.current
      if (dy > 0) {
        setPullDistance(Math.min(dy, THRESHOLD * 1.5))
        if (dy > 10) e.preventDefault()
      }
    }
    const onTouchEnd = async () => {
      if (pullDistance >= THRESHOLD && !isRefreshing) {
        setIsRefreshing(true)
        setPullDistance(0)
        setIsPulling(false)
        await Promise.all([loadUser(), loadRecords()])
        setIsRefreshing(false)
      } else {
        setPullDistance(0)
        setIsPulling(false)
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPulling, pullDistance, isRefreshing, loadUser, loadRecords])

  // Horizontal swipe to navigate tabs
  useEffect(() => {
    const el = pageRef.current
    if (!el) return
    const TABS: Tab[] = ['ponto', 'historico', 'banco', 'correcoes', 'perfil']
    const onStart = (e: TouchEvent) => {
      swipeStartX.current = e.touches[0].clientX
      swipeStartY.current = e.touches[0].clientY
    }
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - swipeStartX.current
      const dy = e.changedTouches[0].clientY - swipeStartY.current
      if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy) * 1.2) return
      setTab(cur => {
        const idx = TABS.indexOf(cur)
        if (dx < 0 && idx < TABS.length - 1) return TABS[idx + 1]
        if (dx > 0 && idx > 0) return TABS[idx - 1]
        return cur
      })
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') loadRecords()
    }, 30_000)
    return () => clearInterval(iv)
  }, [loadRecords])

  useEffect(() => {
    if (tab === 'historico') loadHistory()
    if (tab === 'banco') { loadBank(); loadCompensation() }
    if (tab === 'correcoes') loadCorrections()
  }, [tab, loadHistory, loadBank, loadCorrections, loadCompensation])

  useEffect(() => {
    if (tab === 'correcoes' && corrLoaded) markCorrectionsSeen(corrList)
  }, [tab, corrLoaded, corrList, markCorrectionsSeen])

  // Reset reminder dismissed state when employee punches out / state changes
  useEffect(() => {
    setReminderDismissed(false)
  }, [records])


  const showToast = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const queueOfflinePunch = (type: PunchType) => {
    enqueue(type)
    setQueueCount(c => c + 1)
    showToast(t('ponto.offline_queued'))
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(reg => (reg as any).sync?.register('punch-queue'))
        .catch(() => {})
    }
  }

  const punch = async (type: PunchType) => {
    if (!user || punching) return
    if ('vibrate' in navigator) navigator.vibrate(50)
    setPunching(true)

    if (!navigator.onLine) {
      queueOfflinePunch(type)
      setPunching(false)
      return
    }

    const geoMode = user.geo_mode ?? 'optional'
    let geo: { lat: number; lng: number } | null = null
    if (geoMode !== 'disabled') {
      geo = await getGeo()
      if (geoMode === 'required' && !geo) {
        showToast(t('ponto.geo_required'))
        setPunching(false)
        return
      }
    }

    // Optimistic: add a temporary record before the network round-trip so the
    // UI state (ring, status chip, action buttons) flips immediately.
    const tempId = `optimistic-${Date.now()}`
    const optimisticRec: PunchRecord = {
      id: tempId,
      employee_id: user.id,
      employee_name: user.name,
      type,
      timestamp: new Date().toISOString(),
      date: businessDate(),
    }
    setRecords(prev => [...prev, optimisticRec])

    try {
      const res = await apiFetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}) }),
      })
      if (res.ok) {
        const rec: PunchRecord = await res.json()
        // Replace optimistic record with the authoritative server record
        setRecords(prev => [...prev.filter(r => r.id !== tempId), rec])
        invalidateHistory()
        setPunchError(null)
        showToast(type === 'entrada' ? t('ponto.registered_in') : type === 'saída' ? t('ponto.registered_out') : t(`punch.${type}` as Parameters<typeof t>[0]))
        loadRecords()
      } else {
        setRecords(prev => prev.filter(r => r.id !== tempId))
        const d = await res.json()
        const errMsg = d.error ?? t('ponto.connect_error')
        setPunchError(errMsg)
        showToast(errMsg)
      }
    } catch {
      setRecords(prev => prev.filter(r => r.id !== tempId))
      queueOfflinePunch(type)
    }
    finally { setPunching(false) }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const saveEmail = async () => {
    setProfileEmailSaving(true); setProfileEmailMsg(null)
    try {
      const res = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: profileEmail || null }) })
      if (res.ok) setProfileEmailMsg({ ok: true, text: t('profile.email_saved') })
      else { const d = await res.json(); setProfileEmailMsg({ ok: false, text: d.error ?? t('ponto.connect_error') }) }
    } catch { setProfileEmailMsg({ ok: false, text: t('ponto.connect_error') }) }
    finally { setProfileEmailSaving(false) }
  }

  const changePassword = async () => {
    setPwdMsg(null)
    if (pwdNext !== pwdConfirm) { setPwdMsg({ ok: false, text: t('pwd.mismatch') }); return }
    if (pwdNext.length < 6) { setPwdMsg({ ok: false, text: t('pwd.min_chars') }); return }
    setPwdSaving(true)
    try {
      const res = await fetch('/api/auth/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwdCurrent, newPassword: pwdNext }) })
      if (res.ok) {
        setPwdMsg({ ok: true, text: t('pwd.success') })
        setPwdCurrent(''); setPwdNext(''); setPwdConfirm('')
      } else { const d = await res.json(); setPwdMsg({ ok: false, text: d.error ?? t('ponto.connect_error') }) }
    } catch { setPwdMsg({ ok: false, text: t('ponto.connect_error') }) }
    finally { setPwdSaving(false) }
  }

  if (fetchError) return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ padding: 32, textAlign: 'center', maxWidth: 340 }}>
        <div style={{ color: 'var(--fg-muted)', marginBottom: 16 }}>{t('error.connect')}</div>
        <button onClick={() => { setFetchError(false); loadUser(); loadRecords() }} className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>
          {t('common.retry')}
        </button>
      </div>
    </div>
  )

  if (!user) return (
    <div className="app">
      <div className="main">
        <div className="topbar">
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0 }} />
          <div className="skeleton" style={{ width: 120, height: 13 }} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
            <div className="skeleton skeleton-avatar" style={{ width: 30, height: 30 }} />
          </div>
        </div>
        <div className="page">
          <div className="emp-card" style={{ gap: 20 }}>
            <div className="skeleton" style={{ height: 18, width: '50%', margin: '0 auto' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div className="skeleton" style={{ width: 90, height: 56, borderRadius: 4 }} />
              <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 999 }} />
            </div>
            <div className="skeleton" style={{ height: 110, borderRadius: 10 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ height: 54, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const myRecs = myRecsMemo
  const state = stateMemo
  const since = sinceMemo
  const liveMin = calcLiveMin(myRecs, user.lunch_break_minutes)
  const targetMin = user.workday_hours * 60
  const pct = Math.min(100, (liveMin / targetMin) * 100)
  const remaining = Math.max(0, targetMin - liveMin)
  const overtime = Math.max(0, liveMin - targetMin)
  const earnings = user.hourly_rate ? (liveMin / 60) * user.hourly_rate : null

  const hh = now ? String(now.getHours()).padStart(2, '0') : '--'
  const mm = now ? String(now.getMinutes()).padStart(2, '0') : '--'
  const ss = now ? String(now.getSeconds()).padStart(2, '0') : '--'
  const greeting = now && now.getHours() < 12 ? t('ponto.greeting.morning') : now && now.getHours() < 19 ? t('ponto.greeting.afternoon') : t('ponto.greeting.evening')

  return (
    <div className="app" data-collapsed={sidebarCollapsed ? 'true' : undefined}>
      {toast && <div className="toast">{toast}<div className="toast-progress"/></div>}

      {showSettings && (
        <SettingsModal
          theme={theme}
          accent={accent}
          font={font}
          isSystemTheme={isSystemTheme}
          onSelectTheme={selectTheme}
          onChangeAccent={changeAccent}
          onChangeFont={changeFont}
          onChangePwd={() => { setTab('perfil'); setShowSettings(false) }}
          onLogout={handleLogout}
          onClose={() => setShowSettings(false)}
        />
      )}

      {sidebarMobileOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarMobileOpen(false)} />
      )}

      <EmpSidebar
        tab={tab}
        setTab={setTab}
        user={user}
        onOpenSettings={() => setShowSettings(true)}
        mobileOpen={sidebarMobileOpen}
        onMobileClose={() => setSidebarMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        badges={{ correcoes: corrBadge, ponto: queueCount }}
      />

      <div className="main">
        <div className="topbar">
          <button
            className="topbar-hamburger"
            onClick={() => setSidebarMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="breadcrumbs">
            <span className="crumb">PontoGlass</span>
            <span className="sep">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </span>
            <span className="crumb current">{t(TAB_TITLES[tab])}</span>
          </div>
          <div style={{ flex: 1 }} />
          <button
            className="emp-user-menu"
            onClick={() => setShowSettings(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8 }}
            title="Configurações"
          >
            <div className="emp-user-info">
              <div className="emp-user-name">{user.name.split(' ').slice(0, 2).join(' ')}</div>
              <div className="emp-user-role">@{user.username}</div>
            </div>
            <div className={`avatar size-30 av-c${empColor(user.id)}`}>{avatarInitials(user.name)}</div>
          </button>
        </div>

        <div className="page" ref={pageRef} id="main-content">

        {/* ── PULL-TO-REFRESH INDICATOR ─────────────────────────────────── */}
        {(pullDistance > 8 || isRefreshing) && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            height: Math.max(pullDistance, isRefreshing ? 48 : 0),
            pointerEvents: 'none', zIndex: 10,
            transition: isRefreshing ? 'height 0.2s' : 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: isRefreshing ? 'none' : `rotate(${Math.min(pullDistance / 72 * 360, 360)}deg)`,
              transition: isRefreshing ? 'transform 0.3s' : 'none',
            }}>
              <RefreshIcon size={16} />
            </div>
          </div>
        )}

        {/* ── OFFLINE / QUEUE BANNER ────────────────────────────────────── */}
        {(!isOnline || queueCount > 0) && (
          <div style={{
            background: !isOnline ? 'rgba(234,179,8,0.10)' : 'rgba(99,102,241,0.10)',
            border: `1px solid ${!isOnline ? 'var(--warning, #ca8a04)' : 'var(--accent)'}`,
            borderRadius: 'var(--r-md)',
            padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 8, fontSize: 12,
          }}>
            <span style={{ fontSize: 14 }}>{!isOnline ? '📡' : '🔄'}</span>
            <span style={{ color: 'var(--fg)' }}>
              {!isOnline ? t('ponto.offline') : t('ponto.queue_synced').replace('{n}', String(queueCount)).replace('!', '')}
              {!isOnline && queueCount > 0 && <span style={{ color: 'var(--fg-muted)', marginLeft: 4 }}>· {queueCount} pendente{queueCount !== 1 ? 's' : ''}</span>}
            </span>
          </div>
        )}

        {/* ── AUTO EXIT BANNER ─────────────────────────────────────────────── */}
        {autoExitBanner && (
          <div style={{
            background: 'rgba(234,179,8,0.12)',
            border: '1px solid var(--warning, #ca8a04)',
            borderRadius: 'var(--r-md)',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 16 }}>📍</span>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--fg)' }}>{autoExitBanner}</div>
            <button onClick={() => setAutoExitBanner(null)} className="btn ghost sm" style={{ fontSize: 11, flexShrink: 0 }}>
              {t('common.close')}
            </button>
          </div>
        )}

        {/* ── OVERTIME REMINDER BANNER ───────────────────────────────────── */}
        {tab === 'ponto' && state === 'working' && overtime > 15 && !reminderDismissed && (
          <div style={{
            background: 'var(--warning-soft, rgba(234,179,8,0.12))',
            border: '1px solid var(--warning, #ca8a04)',
            borderRadius: 'var(--r-md)',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 16 }}>⏰</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{t('ponto.reminder')}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                {t('ponto.reminder.body').replace('{n}', String(Math.round(overtime)))}
              </div>
            </div>
            <button
              onClick={() => setReminderDismissed(true)}
              className="btn ghost sm"
              style={{ flexShrink: 0, fontSize: 11 }}
            >
              {t('ponto.reminder.dismiss')}
            </button>
          </div>
        )}

        {/* ── TAB CONTENT (key forces remount for enter animation) ─────────── */}
        <div key={tab} className="tab-fade" role="tabpanel" id={`tabpanel-${tab}`} aria-label={t(TAB_TITLES[tab])}>
        <ErrorBoundary>
        {/* ── PONTO TAB ─────────────────────────────────────────────────────── */}
        {tab === 'ponto' && (
          <PontoTab
            user={user} state={state} since={since}
            liveMin={liveMin} targetMin={targetMin} pct={pct}
            remaining={remaining} overtime={overtime} earnings={earnings}
            hh={hh} mm={mm} ss={ss} greeting={greeting}
            myRecs={myRecs} punching={punching} punch={punch}
            geoDistance={geoDistance} setConfirmingOut={setConfirmingOut}
            punchError={punchError} onDismissPunchError={() => setPunchError(null)}
          />
        )}

        {/* ── HISTÓRICO TAB ─────────────────────────────────────────────────── */}
        {tab === 'historico' && (
          <HistoricoTab
            user={user}
            historyLoading={historyLoading} historyLoaded={historyLoaded}
            historyRecs={historyRecs} historyExceptionsFull={historyExceptionsFull}
            byDay={byDay} sortedDays={sortedDays}
            totalMonthMin={totalMonthMin} absentDays={absentDays}
            histYM={histYM} histMonthLabel={histMonthLabel}
            isCurrentHistMonth={isCurrentHistMonth}
            calendarView={calendarView} setCalendarView={setCalendarView}
            goPrevMonth={goPrevMonth} goNextMonth={goNextMonth}
          />
        )}

        {/* ── BANCO TAB ─────────────────────────────────────────────────────── */}
        {tab === 'banco' && (
          <BancoTab
            bankLoading={bankLoading} bankBalance={bankBalance}
            compLoading={compLoading} compLoaded={compLoaded} compList={compList}
            compDate={compDate} setCompDate={setCompDate}
            compHours={compHours} setCompHours={setCompHours}
            compReason={compReason} setCompReason={setCompReason}
            compSubmitting={compSubmitting} compMsg={compMsg}
            submitCompensation={submitCompensation}
          />
        )}
        {/* ── CORREÇÕES TAB ─────────────────────────────────────────────── */}
        {tab === 'correcoes' && (
          <CorrecoesTab
            corrLoading={corrLoading} corrLoaded={corrLoaded} corrList={corrList}
            corrDate={corrDate} setCorrDate={setCorrDate}
            corrTime={corrTime} setCorrTime={setCorrTime}
            corrType={corrType} setCorrType={setCorrType}
            corrReason={corrReason} setCorrReason={setCorrReason}
            corrSubmitting={corrSubmitting} corrMsg={corrMsg}
            submitCorrection={submitCorrection}
          />
        )}
        {/* ── PERFIL TAB ────────────────────────────────────────────────── */}
        {tab === 'perfil' && (
          <PerfilTab
            user={user} theme={theme} isSystemTheme={isSystemTheme} selectTheme={selectTheme}
            profileEmail={profileEmail} setProfileEmail={setProfileEmail}
            profileEmailSaving={profileEmailSaving} profileEmailMsg={profileEmailMsg}
            setProfileEmailMsg={setProfileEmailMsg}
            pwdCurrent={pwdCurrent} setPwdCurrent={setPwdCurrent}
            pwdNext={pwdNext} setPwdNext={setPwdNext}
            pwdConfirm={pwdConfirm} setPwdConfirm={setPwdConfirm}
            pwdSaving={pwdSaving} pwdMsg={pwdMsg} setPwdMsg={setPwdMsg}
            saveEmail={saveEmail} changePassword={changePassword}
            showToast={showToast}
          />
        )}
        </ErrorBoundary>
        </div>
        </div>
      </div>

      {/* ── PUNCH-OUT CONFIRMATION ──────────────────────────────────────────── */}
      {confirmingOut && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setConfirmingOut(false)}
        >
          <div
            className="sheet-up"
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--sidebar-bg)', borderRadius: 'var(--r-lg) var(--r-lg) 0 0', padding: '24px 24px 48px', width: '100%', maxWidth: 480 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>{t('ponto.confirm_out')}</div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 20 }}>{t('ponto.confirm_out.body')}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-emp" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmingOut(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-emp danger-big"
                style={{ flex: 2, justifyContent: 'center' }}
                onClick={() => { setConfirmingOut(false); punch('saída') }}
                disabled={punching}
              >
                <StopIcon size={14}/> {t('ponto.confirm_out.yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
