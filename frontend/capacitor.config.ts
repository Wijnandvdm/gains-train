import type { CapacitorConfig } from '@capacitor/cli'

// The Android app: the same web app, bundled with the exercise photos so it works fully
// offline. Build it with scripts/android.sh.
const config: CapacitorConfig = {
  // Google Play's package name: permanent once the app is published there.
  appId: 'io.github.wijnandvdm.gainstrain',
  appName: 'gains-train',
  webDir: 'dist',
}

export default config
