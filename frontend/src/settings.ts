import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings } from './data/db'
import type { Settings } from './data/types'

/** Your settings (setup done, rest timer); undefined while loading. Updates live. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, [])
}

export { updateSettings } from './data/db'
