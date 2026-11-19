// The workout's exercise cards, in an order you can change: drag a card by its ≡ (or, with
// the keyboard, focus ≡ and use Space and the arrow keys). Uses dnd-kit (dndkit.com).
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'

export function SortableExercises<T extends { id: string; name: string }>({
  items,
  onMove,
  children,
}: {
  items: T[]
  /** The item was dropped at another place (0 = first). */
  onMove: (item: T, toIndex: number) => void
  /** One card, with the ≡ to drag it by. */
  children: (item: T, dragHandle: ReactNode) => ReactNode
}) {
  const sensors = useSensors(
    // A small move before dragging starts, so a tap on ≡ isn't a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const item = items.find((i) => i.id === active.id)
    const toIndex = items.findIndex((i) => i.id === over.id)
    if (item && toIndex >= 0) onMove(item, toIndex)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableCard key={item.id} id={item.id} name={item.name}>
            {(handle) => children(item, handle)}
          </SortableCard>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableCard({
  id,
  name,
  children,
}: {
  id: string
  name: string
  children: (dragHandle: ReactNode) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Move ${name}`}
      // touch-none: on a phone, dragging ≡ moves the card instead of scrolling the page.
      className="-ml-1 shrink-0 cursor-grab touch-none rounded-md px-1 py-2 text-xl leading-none text-neutral-400 hover:bg-neutral-100 active:cursor-grabbing dark:hover:bg-neutral-800"
    >
      ≡
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-10 opacity-90 shadow-lg' : ''}`}
    >
      {children(handle)}
    </div>
  )
}
