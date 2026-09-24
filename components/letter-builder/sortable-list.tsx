"use client";

import { useMemo, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Daftar vertikal yang dapat diurutkan via drag & drop (dnd-kit).
 *
 * Dipakai bersama oleh editor blok (susunan blok) dan editor halaman
 * (daftar halaman). Handle drag eksplisit agar interaksi lain di dalam baris
 * (tombol, input) tetap dapat diklik tanpa memicu drag.
 */

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  /**
   * Render isi baris. `handle` adalah elemen handle drag (ikon GripVertical)
   * yang HARUS disisipkan di dalam baris oleh pemanggil.
   */
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
  className?: string;
  /** Aksesibilitas: label tombol handle untuk pembaca layar. */
  ariaItemLabel?: (item: T, index: number) => string;
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  className,
  ariaItemLabel,
}: SortableListProps<T>) {
  const ids = useMemo(() => items.map(getId), [items, getId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={cn("space-y-1", className)}>
          {items.map((item, idx) => (
            <SortableRow
              key={getId(item)}
              id={getId(item)}
              ariaLabel={ariaItemLabel?.(item, idx)}
            >
              {(handle) => renderItem(item, idx, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/** Baris individual yang mengikat handle drag ke item. */
function SortableRow({
  id,
  ariaLabel,
  children,
}: {
  id: string;
  ariaLabel?: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handle = (
    <button
      type="button"
      className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      aria-label={ariaLabel || "Ubah urutan"}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}
