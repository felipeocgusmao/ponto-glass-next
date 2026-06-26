'use client'

/**
 * Thin fetch wrapper: if the server returns 401, redirect to /login immediately
 * so the user never sees silent failures from an expired session.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.replace('/login')
  }
  return res
}
