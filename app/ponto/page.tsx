'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PunchRecord, DayException } from '@/lib/types'
import EmpSidebar from './_components/EmpSidebar'
import { PontoTab } from './_components/PontoTab'
import { HistoricoTab } from './_components/HistoricoTab'
import { BancoTab } from './_components/BancoTab'
import { CorrecoesTab } from './_components/CorrecoesTab'
import { PerfilTab } from './_components/PerfilTab'
import { calcNetMinutes, roundToQuarter, businessDate, empColor, avatarInitials, getWorkState, calcLiveMin } from '@/lib/utils'
import { useLang } from '@/lib/LangContext'
import { getQueue, enqueue, flushQueue } from '@/lib/punchQueue'
import SettingsModal from '@/app/admin/_components/SettingsModal'
import { usePunchData } from './_lib/usePunchData'
import { useThemeSettings } from '@/lib/hooks/useThemeSettings'
import { usePushNotifications } from './_lib/usePushNotifications'
import { useGeofence } from './_lib/useGeofence'

type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'
type Tab = 'ponto' | 'historico' | 'banco' | 'correcoes' | 'perfil'

async function getGeo(): Promise<{ lat: number; lng: number } | null> {
  const { getPosition } = await import('@/lib/native')
  return getPosition(8000)
}

type CorrectionStatus = 'pending' | 'approved' | 'rejected'
interface CorrReq { id: string; req_type: string; req_timestamp: string; req_date: string; reason: string | null; status: CorrectionStatus; reviewer_note: string | null; created_at: string }
interface CompReq { id: string; date: string; hours_requested: number; reason: string; status: CorrectionStatus; reviewer_note: string | null; created_at: string }

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

export default function PontoPage() {
  const { t } = useLang()
  const { theme, isSystemTheme, accent, font, selectTheme, toggleTheme, changeAccent, changeFont, syncFromServer } = useThemeSettings({
    onThemeChange: (mode) => {
      fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: mode }) }).catch(() => {})
    },
  })
  const { user, setUser, records, setRecords, fetchError, setFetchError, loadUser, loadRecords } = usePunchData({ onUserTheme: syncFromServer })
  const [showSettings, setShowSettings] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const [punching, setPunching] = useState(false)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<Tab>('ponto')
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // history tab state
  const [historyRecs, setHistoryRecs] = useState<PunchRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyExceptions, setHistoryExceptions] = useState<string[]>([])
  const [historyExceptionsFull, setHistoryExceptionsFull] = useState<DayException[]>([])
  const [calendarView, setCalendarView] = useState(false)
  // Which month the history tab shows (month is 0-indexed). Defaults to the current business month.
  const [histYM, setHistYM] = useState(() => {
    const today = businessDate()
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }
  })

  // bank tab state
  const [bankBalance, setBankBalance] = useState<number | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankLoaded, setBankLoaded] = useState(false)

  // compensation request state (inside banco tab)
  const [compList, setCompList] = useState<CompReq[]>([])
  const [compLoaded, setCompLoaded] = useState(false)
  const [compLoading, setCompLoading] = useState(false)
  const [compDate, setCompDate] = useState('')
  const [compHours, setCompHours] = useState('')
  const [compReason, setCompReason] = useState('')
  const [compSubmitting, setCompSubmitting] = useState(false)
  const [compMsg, setCompMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // corrections tab state
  const [corrList, setCorrList] = useState<CorrReq[]>([])
  const [corrLoaded, setCorrLoaded] = useState(false)
  const [corrLoading, setCorrLoading] = useState(false)
  const [corrBadge, setCorrBadge] = useState(0)

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

  // auto-exit banner
  const [autoExitBanner, setAutoExitBanner] = useState<string | null>(null)

  // reminder
  const [reminderDismissed, setReminderDismissed] = useState(false)
  const [corrDate, setCorrDate] = useState('')
  const [corrTime, setCorrTime] = useState('')
  const [corrType, setCorrType] = useState('entrada')
  const [corrReason, setCorrReason] = useState('')
  const [corrSubmitting, setCorrSubmitting] = useState(false)
  const [corrMsg, setCorrMsg] = useState<{ ok: boolean; text: string } | null>(null)

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

  // History tab helpers — must be before early returns (rules of hooks)
  const lunchBreakMin = user?.lunch_break_minutes ?? 60
  const { byDay, sortedDays, totalMonthMin, absentDays } = useMemo(() => {
    const byDay = new Map<string, PunchRecord[]>()
    historyRecs.forEach(r => {
      if (!byDay.has(r.date)) byDay.set(r.date, [])
      byDay.get(r.date)!.push(r)
    })
    const sortedDays = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a))
    const totalMonthMin = sortedDays.reduce((sum, date) => {
      const recs = byDay.get(date)!
      const exact = calcNetMinutes(recs, lunchBreakMin)
      return sum + roundToQuarter(exact)
    }, 0)
    const absentDays: string[] = (() => {
      if (!historyLoaded || (historyRecs.length === 0 && sortedDays.length === 0)) return []
      const pad = (n: number) => String(n).padStart(2, '0')
      const { year, month } = histYM
      const firstOfMonth = `${year}-${pad(month + 1)}-01`
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      const monthEnd = `${year}-${pad(month + 1)}-${pad(lastDay)}`
      const today = businessDate()
      const cur = new Date(firstOfMonth + 'T12:00:00')
      const end = new Date((monthEnd > today ? today : monthEnd) + 'T12:00:00')
      const absent: string[] = []
      while (cur <= end) {
        const d = cur.getDay()
        const iso = cur.toISOString().split('T')[0]
        if (d !== 0 && d !== 6 && !byDay.has(iso) && !historyExceptions.includes(iso)) absent.push(iso)
        cur.setDate(cur.getDate() + 1)
      }
      return absent
    })()
    return { byDay, sortedDays, totalMonthMin, absentDays }
  }, [historyRecs, histYM, historyLoaded, historyExceptions, lunchBreakMin])

  // Extracted hooks
  const { geoDistance } = useGeofence({
    user, records, loadRecords,
    onAutoExit: (msg) => setAutoExitBanner(msg),
  })
  usePushNotifications({ user, records, t: t as (key: string) => string })

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const pad = (n: number) => String(n).padStart(2, '0')
      const { year, month } = histYM
      const from = `${year}-${pad(month + 1)}-01`
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      const monthEnd = `${year}-${pad(month + 1)}-${pad(lastDay)}`
      // Don't query past today for the current month (records.date is the business-tz day).
      const today = businessDate()
      const to = monthEnd > today ? today : monthEnd
      const [res, excRes] = await Promise.all([
        fetch(`/api/reports?from=${from}&to=${to}`),
        fetch(`/api/day-exceptions?from=${from}&to=${to}`),
      ])
      if (res.ok) {
        setHistoryRecs((await res.json()).data)
        if (excRes.ok) {
          const exc: DayException[] = await excRes.json()
          setHistoryExceptions(exc.map(e => e.date))
          setHistoryExceptionsFull(exc)
        }
        setHistoryLoaded(true)
      }
    } catch { /* keep */ }
    finally { setHistoryLoading(false) }
  }, [histYM])

  const loadBank = useCallback(async () => {
    if (bankLoaded) return
    setBankLoading(true)
    try {
      const res = await fetch('/api/hour-bank')
      if (res.ok) { const d = await res.json(); setBankBalance(d.balanceMin); setBankLoaded(true) }
    } catch { /* keep */ }
    finally { setBankLoading(false) }
  }, [bankLoaded])

  const loadCorrections = useCallback(async () => {
    if (corrLoaded) return
    setCorrLoading(true)
    try {
      const res = await fetch('/api/correction-requests')
      if (res.ok) {
        const list: CorrReq[] = await res.json()
        setCorrList(list)
        setCorrLoaded(true)
        const seenRaw = localStorage.getItem('pg.corr_seen')
        const seen: Set<string> = seenRaw ? new Set(JSON.parse(seenRaw)) : new Set()
        const newResolved = list.filter(c => c.status !== 'pending' && !seen.has(c.id))
        setCorrBadge(newResolved.length)
      }
    } catch { /* keep */ }
    finally { setCorrLoading(false) }
  }, [corrLoaded])

  const loadCompensation = useCallback(async () => {
    if (compLoaded) return
    setCompLoading(true)
    try {
      const res = await fetch('/api/compensation-requests')
      if (res.ok) { setCompList(await res.json()); setCompLoaded(true) }
    } catch { /* keep */ }
    finally { setCompLoading(false) }
  }, [compLoaded])

  const submitCompensation = async () => {
    if (!compHours || parseFloat(compHours) <= 0) { setCompMsg({ ok: false, text: t('comp.hours_req') }); return }
    if (!compDate) { setCompMsg({ ok: false, text: t('comp.date_req') }); return }
    if (!compReason.trim()) { setCompMsg({ ok: false, text: t('comp.reason_req') }); return }
    setCompSubmitting(true); setCompMsg(null)
    try {
      const res = await fetch('/api/compensation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: compDate, hours_requested: parseFloat(compHours), reason: compReason.trim() }),
      })
      if (res.ok) {
        setCompMsg({ ok: true, text: t('comp.success') })
        setCompHours(''); setCompReason('')
        setCompLoaded(false)
        await loadCompensation()
      } else {
        const d = await res.json()
        setCompMsg({ ok: false, text: d.error ?? t('comp.err.generic') })
      }
    } catch { setCompMsg({ ok: false, text: t('comp.err.connect') }) }
    finally { setCompSubmitting(false) }
  }

  const submitCorrection = async () => {
    if (!corrDate || !corrTime || !corrType) return
    if (!corrReason.trim()) { setCorrMsg({ ok: false, text: t('corr.reason_req') }); return }
    setCorrSubmitting(true); setCorrMsg(null)
    try {
      // Convert the chosen local wall-clock to a UTC instant, exactly like real punches
      // (now.toISOString()) and manual records. Sending a naive string let the DB (timestamptz)
      // treat it as UTC, shifting the corrected time by the user's timezone offset.
      const timestamp = new Date(`${corrDate}T${corrTime}:00`).toISOString()
      const res = await fetch('/api/correction-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: corrType, timestamp, reason: corrReason || undefined }),
      })
      if (res.ok) {
        setCorrMsg({ ok: true, text: t('corr.success') })
        setCorrReason('')
        setCorrLoaded(false) // force reload
        await loadCorrections()
      } else {
        const d = await res.json()
        setCorrMsg({ ok: false, text: d.error ?? 'Erro ao enviar pedido.' })
      }
    } catch { setCorrMsg({ ok: false, text: 'Erro de conexão.' }) }
    finally { setCorrSubmitting(false) }
  }

  useEffect(() => { loadUser(); loadRecords() }, [loadUser, loadRecords])

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
    const n = new Date()
    const today = businessDate(n)
    setCorrDate(today)
    setCompDate(today)
    setCorrTime(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`)
  }, [])

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
    if (tab !== 'correcoes' || !corrLoaded) return
    const ids = corrList.filter(c => c.status !== 'pending').map(c => c.id)
    localStorage.setItem('pg.corr_seen', JSON.stringify(ids))
    setCorrBadge(0)
  }, [tab, corrLoaded, corrList])

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
      const res = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}) }),
      })
      if (res.ok) {
        const rec: PunchRecord = await res.json()
        // Replace optimistic record with the authoritative server record
        setRecords(prev => [...prev.filter(r => r.id !== tempId), rec])
        setHistoryLoaded(false)
        showToast(type === 'entrada' ? t('ponto.registered_in') : type === 'saída' ? t('ponto.registered_out') : t(`punch.${type}` as Parameters<typeof t>[0]))
        loadRecords()
      } else {
        setRecords(prev => prev.filter(r => r.id !== tempId))
        const d = await res.json()
        showToast(d.error ?? 'Erro ao registrar')
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

  const _todayBiz = businessDate()
  const isCurrentHistMonth = histYM.year === Number(_todayBiz.slice(0, 4)) && histYM.month === Number(_todayBiz.slice(5, 7)) - 1
  const histMonthLabel = new Date(histYM.year, histYM.month, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  const goPrevMonth = () => setHistYM(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })
  const goNextMonth = () => setHistYM(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })

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
        {/* ── PONTO TAB ─────────────────────────────────────────────────────── */}
        {tab === 'ponto' && (
          <PontoTab
            user={user} state={state} since={since}
            liveMin={liveMin} targetMin={targetMin} pct={pct}
            remaining={remaining} overtime={overtime} earnings={earnings}
            hh={hh} mm={mm} ss={ss} greeting={greeting}
            myRecs={myRecs} punching={punching} punch={punch}
            geoDistance={geoDistance} setConfirmingOut={setConfirmingOut}
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
