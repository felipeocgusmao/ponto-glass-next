import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createJWT, createTotpPendingToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { checkRateLimit, clientIp, applyRateLimitHeaders } from '@/lib/rateLimit'
import { logAudit } from '@/lib/audit'
import { DEFAULT_TENANT_ID, resolveLoginTenant } from '@/lib/tenant'
import { isCsrfSafe } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  if (!isCsrfSafe(request))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ip = clientIp(request)
  const rl = await checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    const res = NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429 }
    )
    applyRateLimitHeaders(res.headers, rl)
    return res
  }

  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Usuário e senha são obrigatórios' }, { status: 400 })
  }

  const userKey = `login:user:${String(username).trim().toLowerCase()}`
  const userRl = await checkRateLimit(userKey, 10, 30 * 60 * 1000)
  if (!userRl.allowed) {
    const res = NextResponse.json(
      { error: 'Conta temporariamente bloqueada. Tente novamente em 30 minutos.' },
      { status: 429 }
    )
    applyRateLimitHeaders(res.headers, userRl)
    return res
  }

  // Which tenant is this login attempt for? Resolved from the host (custom
  // domain → slug subdomain → default). Null means the URL names a tenant
  // subdomain that doesn't exist — refuse instead of guessing.
  const tenantId = await resolveLoginTenant(request)
  if (!tenantId) {
    return NextResponse.json(
      { error: 'Empresa não encontrada para este endereço. Verifique o link com o seu administrador.' },
      { status: 404 }
    )
  }

  // First-run bootstrap: create the initial admin ONLY from an explicit env-provided
  // password. Never seed a hardcoded default (e.g. "admin123") — on a public deploy that
  // is a known credential anyone could use before the owner's first login. Set
  // INITIAL_ADMIN_PASSWORD on first deploy, log in, then remove it from the environment.
  // Bootstrap targets the default tenant explicitly — that's the only one that can be empty.
  if (tenantId === DEFAULT_TENANT_ID) {
    const { count } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (count === 0) {
      const seedPwd = process.env.INITIAL_ADMIN_PASSWORD
      if (!seedPwd || seedPwd.length < 8) {
        return NextResponse.json(
          { error: 'Sistema não inicializado. Defina INITIAL_ADMIN_PASSWORD (mín. 8 caracteres) no ambiente e faça login novamente.' },
          { status: 503 }
        )
      }
      const hash = await bcrypt.hash(seedPwd, 10)
      await supabase.from('employees').insert({
        name: 'Administrador',
        username: (process.env.INITIAL_ADMIN_USERNAME ?? 'admin').trim().toLowerCase(),
        password_hash: hash,
        role: 'admin',
        tenant_id: tenantId,
      })
    }
  }

  // Username uniqueness is now scoped to the tenant (employees_tenant_username_key),
  // so the same username can exist in two different companies — always filter by tenant.
  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('username', String(username).trim().toLowerCase())
    .eq('active', true)
    .single()

  if (!employee) {
    // Compare against a valid dummy hash so response timing doesn't reveal whether the user exists.
    await bcrypt.compare(password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy')
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, employee.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos' }, { status: 401 })
  }

  // Second factor: password alone doesn't open a session when TOTP is on.
  // The pending token only authorizes POST /api/auth/login/totp for 5 min.
  if ((employee as { totp_enabled?: boolean }).totp_enabled === true) {
    const pending = await createTotpPendingToken(
      employee.id,
      (employee as { tenant_id?: string }).tenant_id ?? tenantId,
    )
    return NextResponse.json({ totp_required: true, pending })
  }

  const token = await createJWT({
    id: employee.id,
    name: employee.name,
    username: employee.username,
    role: employee.role,
    tenant_id: (employee as { tenant_id?: string }).tenant_id ?? tenantId,
  })

  logAudit(
    { id: employee.id, name: employee.name, tenant_id: (employee as { tenant_id?: string }).tenant_id ?? tenantId },
    'employee_login', null, { ip, username: employee.username }
  )

  void (async () => {
    try {
      await supabase.from('login_sessions').insert({
        tenant_id: (employee as { tenant_id?: string }).tenant_id ?? tenantId,
        employee_id: employee.id,
        ip,
        user_agent: request.headers.get('user-agent') ?? '',
      })
    } catch { /* graceful — table may not exist yet */ }
  })()

  const res = NextResponse.json({ success: true, role: employee.role })
  res.cookies.set('ponto_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
