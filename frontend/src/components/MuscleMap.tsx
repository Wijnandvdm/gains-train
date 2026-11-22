import createBodyHighlighter, { ModelType } from 'body-highlighter'
import { useEffect, useRef } from 'react'
import { regionsFor } from '../lib/muscleMap'
import { useShownTheme } from '../theme'

const VIEWS = [ModelType.ANTERIOR, ModelType.POSTERIOR]

/** Colours come from CSS tokens (--map-*) so they follow light/dark mode. */
function readColors() {
  const css = getComputedStyle(document.documentElement)
  const get = (name: string) => css.getPropertyValue(name).trim()
  return {
    body: get('--map-body'),
    primary: get('--map-primary'),
    secondary: get('--map-secondary'),
  }
}

/**
 * Front and back body with the worked muscles highlighted (primary darker, secondary
 * lighter). Drawn by body-highlighter, which renders straight into the DOM.
 */
export function MuscleMap({
  primary,
  secondary,
  width = 80,
}: {
  primary: string[]
  secondary: string[]
  width?: number
}) {
  const containers = useRef<(HTMLDivElement | null)[]>([])
  const scheme = useShownTheme() // redrawn in the new colours when you switch
  const primaryKey = primary.join(',')
  const secondaryKey = secondary.join(',')

  useEffect(() => {
    const colors = readColors()
    const primaryRegions = regionsFor(primaryKey ? primaryKey.split(',') : [])
    const secondaryRegions = regionsFor(secondaryKey ? secondaryKey.split(',') : []).filter(
      (r) => !primaryRegions.includes(r), // primary wins where both land on one region
    )
    const instances = VIEWS.map((type, i) =>
      createBodyHighlighter({
        container: containers.current[i]!,
        type,
        bodyColor: colors.body,
        // frequency 1 → secondary colour, 2 → primary colour
        highlightedColors: [colors.secondary, colors.primary],
        data: [
          { name: 'primary', muscles: primaryRegions, frequency: 2 },
          { name: 'secondary', muscles: secondaryRegions, frequency: 1 },
        ],
        style: { width: `${width}px` },
      }),
    )
    return () => instances.forEach((instance) => instance.destroy())
  }, [primaryKey, secondaryKey, width, scheme])

  const describe = (muscles: string[]) => muscles.join(', ')
  return (
    <div
      role="img"
      aria-label={`Muscles worked: ${describe(primary)}${secondary.length ? `; also ${describe(secondary)}` : ''}`}
      className="flex shrink-0"
    >
      {VIEWS.map((view, i) => (
        <div key={view} ref={(el) => void (containers.current[i] = el)} aria-hidden="true" />
      ))}
    </div>
  )
}
