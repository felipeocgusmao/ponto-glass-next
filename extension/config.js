// Deployment configuration for the PontoGlass extension.
//
// If you self-host or use a custom domain, change `baseUrl` here AND update the
// matching entry in manifest.json → "host_permissions" (the extension can only
// send the session cookie to hosts it has permission for).
//
// `businessTz` must match NEXT_PUBLIC_BUSINESS_TZ on the server so the "today"
// boundary and worked-minutes math agree with the web app.
export const CONFIG = {
  baseUrl: 'https://ponto-glass-next.vercel.app',
  businessTz: 'Europe/Madrid',
}
