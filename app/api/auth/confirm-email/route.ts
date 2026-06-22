import { NextRequest, NextResponse } from 'next/server'
import { verifyPasswordResetToken } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/auth/confirm-email?token=<jwt>&tenant=<tenant_id>
// Confirms an email address change initiated from PATCH /api/me.
// The token payload contains { sub: userId, pwh: "email:<newEmail>" } so it is
// automatically invalidated if the user initiates another email change
// (new token with a different pwh) or the same token cannot be replayed.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const tenantId = searchParams.get('tenant')

  if (!token || !tenantId)
    return new Response('Link inválido.', { status: 400 })

  let claims: { sub: string; pwh?: string }
  try { claims = await verifyPasswordResetToken(token) }
  catch { return new Response('Link expirado ou inválido.', { status: 400 }) }

  const newEmail = claims.pwh?.startsWith('email:') ? claims.pwh.slice(6) : null
  if (!newEmail)
    return new Response('Link inválido.', { status: 400 })

  // Check the stored pending token matches (single-use enforcement).
  const { data: emp } = await supabase
    .from('employees')
    .select('pending_email, pending_email_token, pending_email_expires_at')
    .eq('tenant_id', tenantId)
    .eq('id', claims.sub)
    .maybeSingle()

  if (!emp || emp.pending_email !== newEmail || emp.pending_email_token !== token)
    return new Response('Link inválido ou já utilizado.', { status: 400 })

  if (emp.pending_email_expires_at && new Date(emp.pending_email_expires_at) < new Date())
    return new Response('Link expirado. Solicite uma nova alteração de e-mail.', { status: 400 })

  const { error } = await supabase
    .from('employees')
    .update({
      email: newEmail,
      pending_email: null,
      pending_email_token: null,
      pending_email_expires_at: null,
    })
    .eq('tenant_id', tenantId)
    .eq('id', claims.sub)

  if (error)
    return new Response('Erro ao confirmar e-mail. Tente novamente.', { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.redirect(new URL('/ponto?email_confirmed=1', appUrl))
}
