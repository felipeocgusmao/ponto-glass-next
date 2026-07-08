import type { CapacitorConfig } from '@capacitor/cli'

// The mobile app loads the live Vercel deployment via server.url so all API
// routes, auth cookies and server-side logic work without a local server.
// Override CAPACITOR_SERVER_URL in CI / custom deployments.
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? 'https://ponto-glass-next.vercel.app'

const config: CapacitorConfig = {
  appId: 'app.pontoglass.ponto',
  appName: 'PontoGlass',
  webDir: 'out',
  // Native web-view background. Matches the app's dark base (--bg) so any area
  // the web content doesn't cover (safe areas, overscroll) shows the app colour
  // instead of a black bar — the app reaches the screen edges as one surface.
  backgroundColor: '#08090b',
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      // Show push alerts, badge and sound while the app is in the foreground.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      // Overlay the web view (transparent bar) instead of painting a solid
      // band, so the app background runs under the status bar too.
      overlaysWebView: true,
    },
    Geolocation: {
      // iOS: prompt for "When in Use" permission on first geo request.
    },
  },
}

export default config
