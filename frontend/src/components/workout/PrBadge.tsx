// The personal-record badges: 🏆 PR for a heavier weight than ever, plain PR for a better
// estimated 1RM or more reps at a weight. During a workout and when looking back in History.
import { plural } from '../../lib/format'
import { PR_LABELS, type PrKind, type WorkoutPrs } from '../../workout/prs'

const BADGE = 'tone-ticket shrink-0 rounded px-1.5 py-0.5 text-xs font-bold'

/** The badge of one set. */
export function PrBadge({ prs }: { prs: PrKind[] }) {
  const labels = prs.map((k) => PR_LABELS[k])
  return (
    <span
      role="img"
      aria-label={`Personal record: ${labels.join(', ')}`}
      title={labels.join(' · ')}
      className={BADGE}
    >
      {prs.includes('weight') ? '🏆 PR' : 'PR'}
    </span>
  )
}

/** How many sets of a workout set a PR (the cup when one of them was the heaviest yet). */
export function PrCount({ prs }: { prs: WorkoutPrs }) {
  const cup = [...prs.values()].some((kinds) => kinds.includes('weight'))
  const text = plural(prs.size, 'PR')
  return (
    <span role="img" aria-label={plural(prs.size, 'personal record')} className={BADGE}>
      {cup ? `🏆 ${text}` : text}
    </span>
  )
}
