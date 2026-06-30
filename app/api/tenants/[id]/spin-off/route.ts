import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { isValidTenantSlug, DEFAULT_TENANT_ID } from '@/lib/tenant'

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

// Moves every per-tenant row out of the platform (default) tenant into a brand
// new one, then seeds a fresh super-admin "controller" account in the
// now-empty default tenant. Deliberately narrow — only the default tenant can
// be spun off, this is not a generic any-to-any tenant merge tool. See #235.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (params.id !== DEFAULT_TENANT_ID)
    return NextResponse.json(
      { error: 'Esta operação só é permitida no tenant da plataforma (default).' },
      { status: 400 },
    )

  const body = await request.json().catch(() => ({}))
  const {
    name, slug, domain,
    controller_name, controller_username, controller_password,
  } = body

  const trimmedName = String(name ?? '').trim()
  if (trimmedName.length < 2 || trimmedName.length > 100)
    return NextResponse.json({ error: 'Nome deve ter entre 2 e 100 caracteres' }, { status: 400 })

  if (!isValidTenantSlug(slug))
    return NextResponse.json({ error: 'Slug inválido: use minúsculas a-z0-9 com hífens, 2-40 caracteres' }, { status: 400 })

  const trimmedDomain = domain ? String(domain).trim().toLowerCase() : null
  if (trimmedDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmedDomain))
    return NextResponse.json({ error: 'Domínio inválido' }, { status: 400 })

  const trimmedControllerName = String(controller_name ?? '').trim()
  const trimmedControllerUsername = String(controller_username ?? '').trim().toLowerCase()
  if (trimmedControllerName.length < 2 || trimmedControllerName.length > 100)
    return NextResponse.json({ error: 'Nome do controlador deve ter entre 2 e 100 caracteres' }, { status: 400 })
  if (!/^[a-z0-9._-]{3,50}$/.test(trimmedControllerUsername))
    return NextResponse.json({ error: 'Usuário do controlador inválido (3-50: letras, números, ponto, hífen, underscore)' }, { status: 400 })
  if (typeof controller_password !== 'string' || controller_password.length < 6 || controller_password.length > 100)
    return NextResponse.json({ error: 'Senha do controlador deve ter entre 6 e 100 caracteres' }, { status: 400 })

  // 1+2. Create the new tenant and move every per-tenant row into it, atomically
  // (the whole thing is one Postgres transaction — see migrations/20260630_spin_off_tenant.sql).
  const { data: newTenantId, error: spinErr } = await supabase.rpc('spin_off_tenant', {
    p_source_tenant_id: params.id,
    p_name: trimmedName,
    p_slug: slug,
    p_domain: trimmedDomain,
  })
  if (spinErr) {
    if (spinErr.code === '42883') {
      return NextResponse.json(
        { error: 'Função spin_off_tenant não existe ainda. Execute supabase/migrations/20260630_spin_off_tenant.sql no SQL Editor do Supabase.' },
        { status: 503 },
      )
    }
    const msg = /duplicate|unique/i.test(spinErr.message)
      ? 'Slug ou domínio já está em uso por outra empresa'
      : spinErr.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { data: newTenant } = await supabase
    .from('tenants')
    .select('id, name, slug, domain, plan, active, created_at')
    .eq('id', newTenantId)
    .single()

  // 3. Seed a fresh controller account in the now-empty source (default) tenant.
  // Data is already safely migrated at this point — if this insert fails, it's
  // surfaced as a partial-success (207) rather than rolled back, since undoing
  // a successful migration the admin already saw would be worse than leaving
  // them to retry just this last step. The login route also auto-seeds an
  // admin from INITIAL_ADMIN_PASSWORD the next time someone logs into the
  // (now employee-less) default tenant, as a fallback.
  const hash = await bcrypt.hash(controller_password, 10)
  const { error: cErr } = await supabase.from('employees').insert({
    tenant_id: params.id,
    name: trimmedControllerName,
    username: trimmedControllerUsername,
    password_hash: hash,
    role: 'admin',
    super_admin: true,
  })
  if (cErr) {
    return NextResponse.json({
      error: `Dados migrados com sucesso para "${trimmedName}", mas falhou ao criar a conta de controlador: ${cErr.message}. Defina INITIAL_ADMIN_PASSWORD e faça login na plataforma para criar uma conta automaticamente.`,
      tenant: newTenant,
    }, { status: 207 })
  }

  await logAudit(actor, 'tenant_spin_off', { id: newTenantId, name: trimmedName }, {
    source_tenant_id: params.id, controller_username: trimmedControllerUsername,
  })

  return NextResponse.json(
    { tenant: newTenant, controllerUsername: trimmedControllerUsername },
    { status: 201 },
  )
}
