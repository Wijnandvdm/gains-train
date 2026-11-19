import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RoutineSuggestion } from './RoutineSuggestion'

describe('the "from now on?" question', () => {
  afterEach(() => vi.useRealTimers())

  it('goes away by itself after a few seconds', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const suggestion = {
      dayId: 'd',
      question: 'Do the exercises in this order from now on?',
      change: { kind: 'order' as const, exerciseIds: [] },
    }
    const { rerender } = render(<RoutineSuggestion suggestion={suggestion} onDone={onDone} />)
    expect(screen.getByText(suggestion.question)).toBeVisible()

    act(() => vi.advanceTimersByTime(5000))
    rerender(<RoutineSuggestion suggestion={suggestion} onDone={() => onDone()} />) // a redraw
    act(() => vi.advanceTimersByTime(2900))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200)) // 8 seconds after it showed, redraws or not
    expect(onDone).toHaveBeenCalledOnce()
  })
})
