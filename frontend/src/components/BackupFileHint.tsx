import { backupFileName } from '../data/backup'

/**
 * What the backup file looks like, shown next to the import button so you know which file to
 * pick: the name follows the export's pattern (with today's date as the example).
 */
export function BackupFileHint() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-neutral-500">Pick the backup file you exported earlier, like:</p>
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-2.5 dark:border-neutral-700">
        <span
          aria-hidden="true"
          className="grid h-10 w-9 shrink-0 place-items-center rounded-md bg-neutral-100 font-mono text-sm font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
        >
          {'{ }'}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-mono text-[13px] break-all">{backupFileName()}</span>
          <span className="text-xs text-neutral-500">
            JSON file · usually in Google Drive or Files → Downloads
          </span>
        </span>
      </div>
    </div>
  )
}
