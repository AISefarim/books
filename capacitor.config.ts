import type { CapacitorConfig } from '@capacitor/cli';

// The AI Sefarim iPhone/iPad app: the same site, bundled (dist/), with native
// extras - a daily daf reminder, offline dapim, the status bar and splash.
const config: CapacitorConfig = {
  appId: 'com.aisefarim.app',
  appName: 'AI Sefarim',
  webDir: 'dist',
  backgroundColor: '#020617',
  ios: {
    contentInset: 'never',
    backgroundColor: '#020617',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 700, launchAutoHide: true, backgroundColor: '#020617', showSpinner: false },
    LocalNotifications: { iconColor: '#6366f1' },
  },
};

export default config;
