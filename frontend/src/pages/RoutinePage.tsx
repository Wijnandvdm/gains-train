import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExerciseSummary, RoutineOut } from '../data/types'
import { ExerciseThumb } from '../components/ExerciseImage'
import { Spinner } from '../components/Spinner'
import { ExercisePicker } from '../components/workout/ExercisePicker'
import { useAction } from '../lib/useAction'
import { uuid } from '../lib/uuid'
import { deleteRoutine, saveRoutine, useRoutine } from '../routine'
import { DEFAULT_PLANNED_SETS } from '../workout/plan'
import { ErrorMessage } from '../components/ErrorMessage'

type DraftExercise = { key: string; exercise: ExerciseSummary; sets: number }
type DraftDay = { key: string; id: string | null; name: string; exercises: DraftExercise[] }

function toDraft(routine: RoutineOut | null): DraftDay[] {
  if (!routine?.days.length) return [{ key: uuid(), id: null, name: 'Day 1', exercises: [] }]
  return routine.days.map((d) => ({
    key: d.id,
    id: d.id, // kept, so past workouts stay linked and the rotation keeps its place
    name: d.name,
    exercises: d.exercises.map((e) => ({ key: uuid(), exercise: e.exercise, sets: e.sets })),
  }))
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items
  const copy = [...items]
  copy.splice(to, 0, ...copy.splice(from, 1))
  return copy
}

export function RoutinePage() {
  const { data: routine, isPending } = useRoutine()
  if (isPending) return <Spinner />
  return <RoutineEditor routine={routine ?? null} />
}

function RoutineEditor({ routine }: { routine: RoutineOut | null }) {
  const navigate = useNavigate()
  const save = useAction(saveRoutine)
  const [days, setDays] = useState<DraftDay[]>(() => toDraft(routine))
  const [pickingFor, setPickingFor] = useState<string | null>(null)

  const updateDay = (key: string, update: (day: DraftDay) => DraftDay) =>
    setDays((all) => all.map((d) => (d.key === key ? update(d) : d)))

  const valid = days.every((d) => d.name.trim())

  async function onSave() {
    await save.run({
      days: days.map((d) => ({
        id: d.id,
        name: d.name.trim(),
        exercises: d.exercises.map((e) => ({ exercise_id: e.exercise.id, sets: e.sets })),
      })),
    })
    navigate('/workout')
  }

  async function onDelete() {
    if (!window.confirm('Stop using a routine? Your past workouts are kept.')) return
    await deleteRoutine()
    navigate('/workout')
  }

  return (
    <section className="flex flex-col gap-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Your routine</h1>
        <p className="text-neutral-500">Days are done in order, then it starts over.</p>
      </div>

      {days.map((day, dayIndex) => (
        <section key={day.key} className="card flex flex-col gap-3 p-3" aria-label={day.name}>
          <div className="flex items-center gap-2">
            <input
              aria-label={`Day ${dayIndex + 1} name`}
              value={day.name}
              onChange={(e) => updateDay(day.key, (d) => ({ ...d, name: e.target.value }))}
              className="input flex-1 font-semibold"
              maxLength={200}
            />
            <IconButton
              label={`Move ${day.name} up`}
              onClick={() => setDays((all) => move(all, dayIndex, dayIndex - 1))}
            >
              ↑
            </IconButton>
            <IconButton
              label={`Move ${day.name} down`}
              onClick={() => setDays((all) => move(all, dayIndex, dayIndex + 1))}
            >
              ↓
            </IconButton>
            <IconButton
              label={`Remove ${day.name}`}
              disabled={days.length === 1}
              onClick={() => setDays((all) => all.filter((d) => d.key !== day.key))}
            >
              ×
            </IconButton>
          </div>

          <ol className="flex flex-col gap-2">
            {day.exercises.map((item, i) => (
              <li key={item.key} className="flex items-center gap-2">
                <ExerciseThumb name={item.exercise.name} src={item.exercise.image_urls[0]} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.exercise.name}
                </span>
                <label className="flex items-center gap-1 text-sm text-neutral-500">
                  <IconButton
                    label={`Fewer sets of ${item.exercise.name}`}
                    disabled={item.sets <= 1}
                    onClick={() =>
                      updateDay(day.key, (d) => ({
                        ...d,
                        exercises: d.exercises.map((e) =>
                          e.key === item.key ? { ...e, sets: e.sets - 1 } : e,
                        ),
                      }))
                    }
                  >
                    −
                  </IconButton>
                  <span className="w-12 text-center tabular-nums" aria-live="polite">
                    {item.sets} sets
                  </span>
                  <IconButton
                    label={`More sets of ${item.exercise.name}`}
                    disabled={item.sets >= 20}
                    onClick={() =>
                      updateDay(day.key, (d) => ({
                        ...d,
                        exercises: d.exercises.map((e) =>
                          e.key === item.key ? { ...e, sets: e.sets + 1 } : e,
                        ),
                      }))
                    }
                  >
                    +
                  </IconButton>
                </label>
                <IconButton
                  label={`Move ${item.exercise.name} up`}
                  onClick={() =>
                    updateDay(day.key, (d) => ({ ...d, exercises: move(d.exercises, i, i - 1) }))
                  }
                >
                  ↑
                </IconButton>
                <IconButton
                  label={`Remove ${item.exercise.name}`}
                  onClick={() =>
                    updateDay(day.key, (d) => ({
                      ...d,
                      exercises: d.exercises.filter((e) => e.key !== item.key),
                    }))
                  }
                >
                  ×
                </IconButton>
              </li>
            ))}
          </ol>
          <button type="button" className="btn" onClick={() => setPickingFor(day.key)}>
            + Add exercise
          </button>
        </section>
      ))}

      <button
        type="button"
        className="btn"
        disabled={days.length >= 14}
        onClick={() =>
          setDays((all) => [
            ...all,
            { key: uuid(), id: null, name: `Day ${all.length + 1}`, exercises: [] },
          ])
        }
      >
        + Add day
      </button>

      <ErrorMessage error={save.error} prefix="Couldn't save:" />
      <button
        type="button"
        className="btn btn-primary py-3 text-base"
        disabled={!valid || save.isPending}
        onClick={() => void onSave().catch(() => {})}
      >
        {save.isPending ? 'Saving…' : 'Save routine'}
      </button>
      {routine && (
        <button
          type="button"
          className="mx-auto text-sm text-neutral-500 hover:text-red-600"
          onClick={() => void onDelete()}
        >
          Stop using a routine
        </button>
      )}

      {pickingFor && (
        <ExercisePicker
          onClose={() => setPickingFor(null)}
          onPick={(exercise) => {
            updateDay(pickingFor, (d) => ({
              ...d,
              exercises: [...d.exercises, { key: uuid(), exercise, sets: DEFAULT_PLANNED_SETS }],
            }))
            setPickingFor(null)
          }}
        />
      )}
    </section>
  )
}

function IconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
    >
      {children}
    </button>
  )
}
