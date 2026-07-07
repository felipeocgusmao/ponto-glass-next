import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'

const BACKUP_COOKIE = 'ponto_sa_backup'

// GET — check if currently impersonating (backup cookie present and valid)
export async function GET() {
  const backup = cookies().get(BACKUP_COOKIE)?.value
  if (!backup) return NextResponse.json({ impersonating: false })

  try {
    await verifyJWT(backup)
    return NextResponse.json({ impersonating: true })
  } catch {
    return NextResponse.json({ impersonating: false })
  }
}

// DELETE — exit impersonation, restore original session
export async function DELETE() {
  const backupToken = cookies().get(BACKUP_COOKIE)?.value
  if (!backupToken) return NextResponse.json({ error: 'Nenhuma sessão de impersonation activa.' }, { status: 400 })

  const res = NextResponse.json({ success: true })
  res.cookies.set('ponto_token', backupToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  res.cookies.delete(BACKUP_COOKIE)
  return res
}
