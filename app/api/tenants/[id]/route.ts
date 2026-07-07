import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyApiAuth } from '@/lib/apiAuth'
import type { ApiUser } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { DEFAULT_TENANT_ID } from '@/lib/tenant'

async function requireSuperAdmin(): Promise<ApiUser | null> {
  const token = cookies().get('ponto_token')?.value
  if (!token) return null
  try {
    const user = await verifyApiAuth(token)
    return user.role === 'admin' && user.super_admin ? user : null
  } catch { return null }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, domain, plan, active, trial_ends_at } = await request.json()
  const updates: Record<string, unknown> = {}

  // slug is deliberately immutable: it's the company's URL — changing it would
  // break every bookmark, PWA install and push subscription of that tenant.

  if (name !== undefined) {
    const trimmed = String(name).trim()
    if (trimmed.length < 2 || trimmed.length > 100)
      return NextResponse.json({ error: 'Nome deve ter entre 2 e 100 caracteres' }, { status: 400 })
    updates.name = trimmed
  }

  if (domain !== undefined) {
    const trimmed = domain ? String(domain).trim().toLowerCase() : null
    if (trimmed && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed))
      return NextResponse.json({ error: 'Domínio inválido' }, { status: 400 })
    updates.domain = trimmed
  }

  if (plan !== undefined) {
    updates.plan = String(plan).trim() || 'standard'
  }

  if (trial_ends_at !== undefined) {
    // null = remove trial (permanent plan); ISO string = set/extend trial
    updates.trial_ends_at = trial_ends_at === null ? null : new Date(trial_ends_at).toISOString()
  }

  if (active !== undefined) {
    // Deactivating the default tenant would lock the platform operators out
    // (they live in it) — refuse.
    if (params.id === DEFAULT_TENANT_ID && active === false)
      return NextResponse.json({ error: 'O tenant default não pode ser desativado' }, { status: 400 })
    updates.active = Boolean(active)
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const { data, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', params.id)
    .select('id, name, slug, domain, plan, active, created_at, trial_ends_at')
    .single()
  if (error || !data) {
    const msg = error && /duplicate|unique/i.test(error.message)
      ? 'Domínio já está em uso por outra empresa'
      : (error?.message ?? 'Empresa não encontrada')
    return NextResponse.json({ error: msg }, { status: error ? 400 : 404 })
  }

  await logAudit(actor, 'tenant_update', { id: data.id, name: data.name }, {
    fields: Object.keys(updates),
  })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const actor = await requireSuperAdmin()
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params

  if (id === DEFAULT_TENANT_ID)
    return NextResponse.json({ error: 'O tenant default não pode ser eliminado' }, { status: 400 })

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('id, name, active')
    .eq('id', id)
    .single()
  if (tErr || !tenant)
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  if (tenant.active)
    return NextResponse.json({ error: 'Desative a empresa antes de eliminar' }, { status: 400 })

  const { count: recordCount } = await supabase
    .from('records')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', id)
  if ((recordCount ?? 0) > 0)
    return NextResponse.json({
      error: 'A empresa tem registos de ponto — não é possível eliminar. Use "Desativar".',
    }, { status: 400 })

  // Delete all dependent rows in safe order before removing the tenant.
  const dependents = [
    'push_subscriptions',
    'correction_requests',
    'hour_bank_adjustments',
    'day_exceptions',
    'records',
    'employees',
    'audit_logs',
  ] as const
  for (const table of dependents)
    await supabase.from(table).delete().eq('tenant_id', id)

  const { error: delErr } = await supabase.from('tenants').delete().eq('id', id)
  if (delErr)
    return NextResponse.json({ error: delErr.message }, { status: 500 })

  await logAudit(actor, 'tenant_delete', { id, name: tenant.name }, { reason: 'permanent_delete' })
  return NextResponse.json({ id, name: tenant.name })
}
