import { withSentryConfig } from '@sentry/nextjs'

// Baseline security headers for every response. No CSP yet — the app relies on
// inline styles/scripts Next.js emits, so a strict policy needs its own pass
// with nonces; these headers are safe to apply unconditionally.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Nothing in the app is meant to be iframed; blocks clickjacking.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // The app itself uses camera (kiosk photo), microphone (voice/glass mode)
  // and geolocation (geofencing) — allow them same-origin only.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,
  // Upload source maps only in CI / production builds
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
})
