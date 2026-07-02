// Minimal Supabase stand-in for E2E runs without a real project.
//
// The specs only exercise unauthenticated flows, so every query may fail —
// but it must fail FAST. Pointing the build at a host that drops connections
// (e.g. ci.supabase.co) makes each supabase-js call take ~7s to surface the
// network error; the login route issues 3 sequential queries and the
// "shows error on bad credentials" specs time out. An instant HTTP 404 makes
// supabase-js return an error in milliseconds instead.
//
// Usage: node e2e/supabase-stub.mjs &   (build with
// NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321)
import { createServer } from 'node:http'

const PORT = Number(process.env.SUPABASE_STUB_PORT ?? 54321)

createServer((req, res) => {
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: 'supabase stub: not found' }))
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[supabase-stub] listening on http://127.0.0.1:${PORT}`)
})
