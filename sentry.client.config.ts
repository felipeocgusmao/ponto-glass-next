import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Only sample 10% of transactions in production to save quota
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Capture replays only for sessions with errors
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,
  integrations: [Sentry.replayIntegration()],
})
