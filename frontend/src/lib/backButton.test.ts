import { afterEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ value: true }))
const app = vi.hoisted(() => ({
  listener: null as null | ((event: { canGoBack: boolean }) => void),
  minimizeApp: vi.fn(async () => {}),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (_: string, listener: typeof app.listener) => {
      app.listener = listener
    }),
    minimizeApp: app.minimizeApp,
  },
}))

const { handleBackButton } = await import('./backButton')

describe("the phone's back button", () => {
  afterEach(() => {
    app.listener = null
    native.value = true
    vi.restoreAllMocks()
  })

  it('goes back to the previous screen', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    await handleBackButton()
    app.listener!({ canGoBack: true })
    expect(back).toHaveBeenCalled()
    expect(app.minimizeApp).not.toHaveBeenCalled()
  })

  it('puts the app in the background from the first screen', async () => {
    await handleBackButton()
    app.listener!({ canGoBack: false })
    expect(app.minimizeApp).toHaveBeenCalled()
  })

  it('leaves a browser alone', async () => {
    native.value = false
    await handleBackButton()
    expect(app.listener).toBeNull()
  })
})
