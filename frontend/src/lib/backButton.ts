/**
 * The phone's back button (Android): back to the previous screen, like a browser's back, and
 * from the first screen out of the app (to the background, as Android does itself, so a rest
 * timer or a workout in progress is still there when you return). Without this, Android
 * closes the app on any screen. Does nothing in a browser, which has its own back.
 */
import { Capacitor } from '@capacitor/core'

export async function handleBackButton(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { App } = await import('@capacitor/app')
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.minimizeApp()
  })
}
