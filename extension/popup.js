import { CONFIG } from './config.js'
import { getWorkState, calcLiveMin, fmtMinutes } from './lib/punch-utils.js'

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  entrada: 'Entrada', 'saída': 'Saída',
  inicio_almoco: 'Início almoço', fim_almoco: 'Fim almoço',
  pausa_cafe: 'Pausa café', retorno_cafe: 'Retorno café',
}
const GREEN_TYPES = ['entrada', 'fim_almoco', 'retorno_cafe']
const AMBER_TYPES = ['inicio_almoco', 'pausa_cafe']
const STATE_LABELS = {
  absent: 'Ausente', working: 'Trabalhando', lunch: 'Em almoço',
  coffee: 'Em pausa', out: 'Encerrado',
}
const RING_CIRC = 2 * Math.PI * 34 // r=34

// ── State ────────────────────────────────────────────────────────────────────
let profile = null
let myRecords = []
let clockTimer = null
let toastTimer = null

// ── DOM helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)
function show(id) {
  for (const s of ['loading', 'logged-out', 'error', 'app']) $(s).classList.toggle('hidden', s !== id)
}
function api(path, init = {}) {
  return fetch(CONFIG.baseUrl + path, { credentials: 'include', ...init })
}
function toast(msg) {
  const el = $('toast')
  el.textContent = msg
  el.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2400)
}
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '—'
}

// ── Geolocation (best-effort) ────────────────────────────────────────────────
function getGeo(timeout = 8000) {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout, maximumAge: 60_000, enableHighAccuracy: false },
    )
  })
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  show('loading')
  let meRes
  try {
    meRes = await api('/api/me')
  } catch {
    return showError('Não foi possível conectar ao PontoGlass.')
  }
  if (meRes.status === 401) return show('logged-out')
  if (!meRes.ok) return showError('Erro ao carregar o perfil.')

  profile = await meRes.json()
  await loadRecords()
  renderApp()
  show('app')
  startClock()

  if (isPrivileged()) loadAdmin()
}

function showError(msg) {
  $('error-msg').textContent = msg
  show('error')
}

function isPrivileged() {
  return profile && (profile.role === 'admin' || profile.role === 'manager')
}

async function loadRecords() {
  try {
    const res = await api(`/api/records?today=true&employeeId=${encodeURIComponent(profile.id)}`)
    myRecords = res.ok ? await res.json() : []
  } catch { myRecords = [] }
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderApp() {
  $('user-name').textContent = (profile.name || '').split(' ').slice(0, 2).join(' ') || '—'
  $('user-handle').textContent = '@' + (profile.username || '')
  $('user-avatar').textContent = initials(profile.name)

  const firstName = (profile.name || '').split(' ')[0] || ''
  $('greeting').innerHTML = `${greetWord()}, <b>${escapeHtml(firstName)}</b>`
  $('today-date').textContent = fmtDate(new Date())

  renderSummary()
  renderActions()
  renderHistory()

  $('admin-panel').classList.toggle('hidden', !isPrivileged())
}

function renderSummary() {
  const lunch = profile.lunch_break_minutes ?? 60
  const liveMin = calcLiveMin(myRecords, lunch)
  const targetMin = (profile.workday_hours ?? 8) * 60
  const pct = targetMin > 0 ? Math.min(100, (liveMin / targetMin) * 100) : 0
  const overtime = Math.max(0, liveMin - targetMin)

  $('m-worked').textContent = liveMin > 0 ? fmtMinutes(liveMin) : '—'
  $('m-overtime').textContent = overtime > 0 ? '+' + fmtMinutes(overtime) : '—'

  $('ring-pct').textContent = Math.round(pct) + '%'
  const ring = $('ring-fg')
  ring.style.strokeDashoffset = String(RING_CIRC * (1 - pct / 100))
  ring.style.stroke = pct >= 100 ? 'var(--green)' : 'var(--amber)'

  if (profile.hourly_rate != null) {
    const earn = (liveMin / 60) * Number(profile.hourly_rate)
    $('m-earn').textContent = earn.toFixed(2).replace('.', ',') + ' €'
    $('m-earn-row').classList.remove('hidden')
  } else {
    $('m-earn-row').classList.add('hidden')
  }

  const { state } = getWorkState(myRecords)
  $('status-chip').textContent = STATE_LABELS[state] || '—'
}

function actionsForState(state) {
  switch (state) {
    case 'absent': return [{ type: 'entrada', label: 'Bater entrada', variant: 'primary' }]
    case 'out': return [{ type: 'entrada', label: 'Bater entrada novamente', variant: 'primary' }]
    case 'lunch': return [{ type: 'fim_almoco', label: 'Fim almoço', variant: 'primary' }]
    case 'coffee': return [{ type: 'retorno_cafe', label: 'Retorno café', variant: 'primary' }]
    case 'working': return [
      { type: 'saída', label: 'Bater saída', variant: 'danger' },
      { type: 'inicio_almoco', label: 'Início almoço', variant: 'ghost', half: true },
      { type: 'pausa_cafe', label: 'Pausa café', variant: 'ghost', half: true },
    ]
    default: return []
  }
}

function renderActions() {
  const { state } = getWorkState(myRecords)
  const actions = actionsForState(state)
  const wrap = $('actions')
  wrap.innerHTML = ''

  const halves = actions.filter(a => a.half)
  const fulls = actions.filter(a => !a.half)

  for (const a of fulls) wrap.appendChild(makeBtn(a))
  if (halves.length) {
    const row = document.createElement('div')
    row.className = 'row'
    for (const a of halves) row.appendChild(makeBtn(a))
    wrap.appendChild(row)
  }
}

function makeBtn(a) {
  const btn = document.createElement('button')
  btn.className = `btn ${a.variant}`
  btn.textContent = a.label
  btn.addEventListener('click', () => punch(a.type, btn))
  return btn
}

function renderHistory() {
  const list = $('hist-list')
  const sorted = [...myRecords].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  $('hist-count').textContent = `${sorted.length} batida${sorted.length !== 1 ? 's' : ''}`
  if (!sorted.length) {
    list.innerHTML = '<div class="hist-empty">Nenhuma batida hoje.</div>'
    return
  }
  list.innerHTML = ''
  for (const r of sorted) {
    const row = document.createElement('div')
    row.className = 'hist-row'
    const cls = GREEN_TYPES.includes(r.type) ? 'green' : AMBER_TYPES.includes(r.type) ? 'amber' : 'red'
    row.innerHTML = `<span class="hist-type ${cls}">${TYPE_LABELS[r.type] || r.type}</span>` +
      `<span class="hist-time">${fmtTime(r.timestamp)}</span>`
    list.appendChild(row)
  }
}

// ── Punch ────────────────────────────────────────────────────────────────────
async function punch(type, btn) {
  const buttons = $('actions').querySelectorAll('button')
  buttons.forEach(b => (b.disabled = true))
  const orig = btn.textContent
  btn.textContent = '…'

  try {
    const geoMode = profile.geo_mode ?? 'optional'
    let geo = null
    if (geoMode !== 'disabled') geo = await getGeo()
    if (geoMode === 'required' && !geo) {
      toast('Localização obrigatória para bater o ponto.')
      return
    }
    const body = { type, ...(geo ? { latitude: geo.lat, longitude: geo.lng } : {}) }
    const res = await api('/api/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      await loadRecords()
      renderSummary(); renderActions(); renderHistory()
      toast(TYPE_LABELS[type] + ' registrada!')
      if (isPrivileged()) loadAdmin()
    } else {
      const d = await res.json().catch(() => ({}))
      toast(d.error || 'Erro ao bater o ponto.')
    }
  } catch {
    toast('Erro de conexão.')
  } finally {
    buttons.forEach(b => (b.disabled = false))
    btn.textContent = orig
  }
}

// ── Admin / manager panel ────────────────────────────────────────────────────
async function loadAdmin() {
  try {
    const [corrRes, recsRes] = await Promise.all([
      api('/api/correction-requests?status=pending'),
      api('/api/records?today=true'),
    ])
    const pending = corrRes.ok ? (await corrRes.json()).length : 0
    const allRecs = recsRes.ok ? await recsRes.json() : []

    $('pending-count').textContent = String(pending)

    const byEmp = new Map()
    for (const r of allRecs) {
      if (!byEmp.has(r.employee_id)) byEmp.set(r.employee_id, { name: r.employee_name, recs: [] })
      byEmp.get(r.employee_id).recs.push(r)
    }
    const active = []
    for (const e of byEmp.values()) {
      const { state } = getWorkState(e.recs)
      if (state === 'working' || state === 'lunch' || state === 'coffee') active.push({ name: e.name, state })
    }
    active.sort((a, b) => a.name.localeCompare(b.name))

    $('working-count').textContent = String(active.length)
    const list = $('working-list')
    list.innerHTML = ''
    for (const e of active.slice(0, 8)) {
      const row = document.createElement('div')
      row.className = 'work-row'
      row.innerHTML = `<span class="work-dot ${e.state}"></span>` +
        `<span class="work-name">${escapeHtml(e.name)}</span>` +
        `<span class="work-state">${STATE_LABELS[e.state]}</span>`
      list.appendChild(row)
    }
  } catch { /* leave panel as-is */ }
}

// ── Clock ────────────────────────────────────────────────────────────────────
function startClock() {
  const tick = () => {
    const n = new Date()
    $('clock-hm').textContent =
      String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0')
    $('clock-s').textContent = ':' + String(n.getSeconds()).padStart(2, '0')
    // keep live worked-minutes / ring fresh while open
    if (myRecords.length) renderSummary()
  }
  tick()
  clearInterval(clockTimer)
  clockTimer = setInterval(tick, 1000)
}

// ── Formatting ───────────────────────────────────────────────────────────────
function greetWord() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite'
}
function fmtDate(d) {
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// ── Wire up static buttons ───────────────────────────────────────────────────
$('login-btn').addEventListener('click', () => openTab(CONFIG.baseUrl + '/login'))
$('retry-btn').addEventListener('click', boot)
$('dashboard-btn').addEventListener('click', () => openTab(CONFIG.baseUrl + '/admin'))
$('stat-pending').addEventListener('click', () => openTab(CONFIG.baseUrl + '/admin'))

function openTab(url) {
  if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url })
  else window.open(url, '_blank')
}

boot()
