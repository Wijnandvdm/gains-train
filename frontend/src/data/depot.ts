// Parking the train in the depot (holiday, injury): parked weeks that fall short don't count
// against your streak. Stored as the weeks' Mondays in the settings (so backups include it).
import { localDateString } from '../lib/format'
import { getSettings, updateSettings } from './db'
import { nextMonday, weekOf } from './line'

export const DEPOT_WEEKS = [1, 2, 3, 4]

/** Park this week and the next weeks, `weeks` in total. */
export async function parkWeeks(weeks: number, today = localDateString()): Promise<void> {
  const parked = new Set((await getSettings()).depot_weeks)
  for (let i = 0, monday = weekOf(today); i < weeks; i++, monday = nextMonday(monday)) {
    parked.add(monday)
  }
  await updateSettings({ depot_weeks: [...parked].sort() })
}

/** Park one week that already ended (you forgot to park before going away). */
export async function parkWeek(monday: string): Promise<void> {
  const parked = new Set((await getSettings()).depot_weeks).add(monday)
  await updateSettings({ depot_weeks: [...parked].sort() })
}

/** Back on the line: unpark this week and any later ones (past weeks stay parked). */
export async function leaveDepot(today = localDateString()): Promise<void> {
  const current = weekOf(today)
  const { depot_weeks } = await getSettings()
  await updateSettings({ depot_weeks: depot_weeks.filter((monday) => monday < current) })
}
