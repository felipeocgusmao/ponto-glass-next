import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST() {
  // Best-effort: revoke tokens issued before now for this user, so a stolen copy of the
  // token can't resume the session after logout. (Invalidates this user on all devices.)
  // No-op if the sessions_valid_from column hasn't been migrated yet.
  const token = cookies().get('ponto_token')?.value
  if (token) {
    try {
      const user = await verifyJWT(token)
      await supabase
        .from('employees')
        .update({ sessions_valid_from: new Date().toISOString() })
        .eq('id', user.id)
    } catch { /* invalid token → nothing to revoke */ }
  }
  const res = NextResponse.json({ success: true })
  res.cookies.delete('ponto_token')
  return res
}
