import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withSentryConfig(nextConfig, {
  // Suppresses source map upload logs during build
  silent: true,
  // Upload source maps only in CI / production builds
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
})
