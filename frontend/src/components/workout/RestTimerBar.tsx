import { REST } from '../../copy'
import { formatClock } from '../../lib/format'
import type { useRestTimer } from '../../workout/restTimer'

/** Floating rest countdown, just above the tab bar. */
export function RestTimerBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  if (timer.remaining === null) return null
  const progress = timer.done ? 1 : 1 - timer.remaining / timer.total

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-4"
    >
      <div
        className={`card mx-auto flex max-w-2xl items-center gap-3 overflow-hidden p-2 shadow-lg ${
          timer.done ? 'border-brand-500' : ''
        }`}
      >
        <div className="relative flex-1 pl-2">
          <p className="text-xs text-neutral-500">{timer.done ? 'Rest over' : REST.resting}</p>
          <p className="text-2xl font-bold tabular-nums" aria-live="polite">
            {timer.done ? REST.done : formatClock(timer.remaining)}
          </p>
          <div className="mt-1 h-1 rounded bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-1 rounded bg-brand-600 transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        {!timer.done && (
          <>
            <button type="button" className="btn px-3" onClick={() => timer.adjust(-15)}>
              −15s
            </button>
            <button type="button" className="btn px-3" onClick={() => timer.adjust(15)}>
              +15s
            </button>
          </>
        )}
        <button type="button" className="btn px-3" onClick={timer.stop}>
          {timer.done ? 'OK' : 'Depart'}
        </button>
      </div>
    </div>
  )
}
