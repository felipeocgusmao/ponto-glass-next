import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { isValidTenantSlug } from '@/lib/tenant'

// Tenant management is platform-operator territory: requires an active admin
// with the super_admin flag (loaded from the DB on every request, never from
// the token).
async function requireSuperAdmin(): Promise<ApiUser | null> {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return user.role === 'admin' && user.super_admin ? user : null
  } catch { return null }
}

export async function GET() {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: tenants, error } = await supabase.from('tenants')
    .select('id, name, slug, domain, plan, active, created_at')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Per-tenant HEAD counts instead of shipping every employees/records row just
  // to count them client-side — records grows unbounded (one row per punch),
  // so the old full-table select made this endpoint slower every single day.
  // Tenant count is small, so parallel queries per tenant stay cheap.
  const withCounts = await Promise.all((tenants ?? []).map(async t => {
    const [empActive, empTotal, rec, lastPunch, lastLogin] = await Promise.all([
      supabase.from('employees').select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id).eq('active', true),
      supabase.from('employees').select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id),
      supabase.from('records').select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id),
      supabase.from('records').select('timestamp')
        .eq('tenant_id', t.id).order('timestamp', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('audit_logs').select('created_at')
        .eq('tenant_id', t.id).eq('action', 'employee_login')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    return {
      ...t,
      employee_count: empActive.count ?? 0,
      employee_total: empTotal.count ?? 0,
      record_count: rec.count ?? 0,
      last_punch_at: lastPunch.data?.timestamp ?? null,
      last_login_at: lastLogin.data?.created_at ?? null,
    }
  }))

  return NextResponse.json(withCounts, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, slug, domain, plan, admin_name, admin_username, admin_password, workday_hours, lunch_break_minutes } = await request.json()

  const trimmedName = String(name ?? '').trim()
  if (trimmedName.length < 2 || trimmedName.length > 100)
    return NextResponse.json({ error: 'Nome deve ter entre 2 e 100 caracteres' }, { status: 400 })

  if (!isValidTenantSlug(slug))
    return NextResponse.json({ error: 'Slug inválido: use minúsculas a-z0-9 com hífens, 2-40 caracteres' }, { status: 400 })

  const trimmedDomain = domain ? String(domain).trim().toLowerCase() : null
  if (trimmedDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmedDomain))
    return NextResponse.json({ error: 'Domínio inválido' }, { status: 400 })

  // A tenant without an admin is unreachable (logins are tenant-scoped), so
  // the first admin is seeded in the same request.
  const trimmedAdminName = String(admin_name ?? '').trim()
  const trimmedAdminUsername = String(admin_username ?? '').trim().toLowerCase()
  if (trimmedAdminName.length < 2 || trimmedAdminName.length > 100)
    return NextResponse.json({ error: 'Nome do admin deve ter entre 2 e 100 caracteres' }, { status: 400 })
  if (!/^[a-z0-9._-]{3,50}$/.test(trimmedAdminUsername))
    return NextResponse.json({ error: 'Usuário do admin inválido (3-50: letras, números, ponto, hífen, underscore)' }, { status: 400 })
  if (typeof admin_password !== 'string' || admin_password.length < 6 || admin_password.length > 100)
    return NextResponse.json({ error: 'Senha do admin deve ter entre 6 e 100 caracteres' }, { status: 400 })

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .insert({ name: trimmedName, slug, domain: trimmedDomain, plan: plan ? String(plan) : 'standard' })
    .select('id, name, slug, domain, plan, active, created_at')
    .single()
  if (tErr) {
    const msg = /duplicate|unique/i.test(tErr.message)
      ? 'Slug ou domínio já está em uso por outra empresa'
      : tErr.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const parsedWorkday = workday_hours ? Number(workday_hours) : 8
  const parsedLunch = lunch_break_minutes ? Number(lunch_break_minutes) : 60

  const hash = await bcrypt.hash(admin_password, 10)
  const { error: eErr } = await supabase.from('employees').insert({
    tenant_id: tenant.id,
    name: trimmedAdminName,
    username: trimmedAdminUsername,
    password_hash: hash,
    role: 'admin',
    workday_hours: isNaN(parsedWorkday) ? 8 : parsedWorkday,
    lunch_break_minutes: isNaN(parsedLunch) ? 60 : parsedLunch,
  })
  if (eErr) {
    // Roll the tenant back rather than leaving an unreachable shell behind.
    await supabase.from('tenants').delete().eq('id', tenant.id)
    return NextResponse.json({ error: `Falha ao criar admin inicial: ${eErr.message}` }, { status: 500 })
  }

  await logAudit(actor, 'tenant_create', { id: tenant.id, name: tenant.name }, {
    slug: tenant.slug, domain: tenant.domain, admin_username: trimmedAdminUsername,
  })
  return NextResponse.json({ ...tenant, employee_count: 1 }, { status: 201 })
}
