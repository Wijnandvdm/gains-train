import { useCallback, useEffect, useRef, useState } from 'react'

type Timer = { endsAt: number; seconds: number }

const TIMER_KEY = 'gains-train:rest-timer'
const SECONDS_KEY = 'gains-train:rest-seconds'
export const DEFAULT_REST_SECONDS = 90
const DONE_BANNER_MS = 4_000

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: the timer still works, it just won't survive a reload.
  }
}

/** The default rest between sets (chosen during setup; ±15s on the timer also changes it). */
export function setDefaultRestSeconds(seconds: number): void {
  write(SECONDS_KEY, seconds)
}

let audio: AudioContext | undefined

/** Browsers only allow sound after a user gesture, so this runs when a set is ticked. */
function unlockAudio(): void {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    // No Web Audio: vibration only.
  }
}

function alertRestOver(): void {
  navigator.vibrate?.([200, 100, 200])
  if (!audio) return
  for (const offset of [0, 0.25]) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, audio.currentTime + offset)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + offset + 0.18)
    osc.connect(gain).connect(audio.destination)
    osc.start(audio.currentTime + offset)
    osc.stop(audio.currentTime + offset + 0.2)
  }
}

/**
 * A rest countdown. It stores the *end time* (not a ticking counter), so it stays right
 * when the phone sleeps or the tab is in the background, and survives reloads.
 */
export function useRestTimer() {
  const [timer, setTimer] = useState<Timer | null>(() => read<Timer>(TIMER_KEY))
  const [seconds, setSeconds] = useState(() => read<number>(SECONDS_KEY) ?? DEFAULT_REST_SECONDS)
  const [now, setNow] = useState(() => Date.now())
  const alertedFor = useRef<number | null>(null)

  useEffect(() => {
    if (!timer) return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [timer])

  const update = useCallback((next: Timer | null) => {
    setTimer(next)
    setNow(Date.now())
    write(TIMER_KEY, next)
  }, [])

  const remaining = timer ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : 0
  const done = timer !== null && remaining === 0

  useEffect(() => {
    if (!done || alertedFor.current === timer.endsAt) return
    alertedFor.current = timer.endsAt
    // Only alert if we're (close to) on time, not when reopening the app hours later.
    if (Date.now() - timer.endsAt < 5_000) alertRestOver()
    const hide = setTimeout(() => update(null), DONE_BANNER_MS)
    return () => clearTimeout(hide)
  }, [done, timer, update])

  return {
    /** null when no timer is running */
    remaining: timer ? remaining : null,
    total: timer?.seconds ?? seconds,
    done,
    start: useCallback(() => {
      unlockAudio()
      update({ endsAt: Date.now() + seconds * 1000, seconds })
    }, [seconds, update]),
    /** ±15s now, and remembered as the new default rest. */
    adjust: useCallback(
      (delta: number) => {
        const nextSeconds = Math.min(600, Math.max(15, seconds + delta))
        setSeconds(nextSeconds)
        write(SECONDS_KEY, nextSeconds)
        if (timer) {
          update({
            endsAt: Math.max(Date.now(), timer.endsAt + delta * 1000),
            seconds: nextSeconds,
          })
        }
      },
      [seconds, timer, update],
    ),
    stop: useCallback(() => update(null), [update]),
  }
}
