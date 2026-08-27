"use client";

import { type ReactNode, useCallback, useId, useMemo, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { NumberFlow } from "@/components/admin/ui/number-flow";
import type { BoardColumn, BoardItem, Density } from "./types";

const COLLISION_STRATEGY = rectIntersection;

function getItemById<T extends BoardItem>(items: T[], id: string): T | undefined {
  return items.find((item) => String(item.id) === id);
}

/**
 * @summary Tablero Kanban con drag & drop fluido, overlay, placeholder y rollback optimista.
 */
export function KanbanBoard<T extends BoardItem>({
  columns,
  initialItems,
  renderItem,
  renderOverlay,
  onMove,
  onReorder,
  storageKey,
  boardTitle,
  toolbar,
  emptyState,
  className,
  density,
  onDragEnd,
}: {
  columns: BoardColumn[];
  initialItems: T[];
  renderItem: (item: T, density: Density, isDragging: boolean) => ReactNode;
  renderOverlay?: (item: T) => ReactNode;
  onMove?: (itemId: string, fromColumnId: string, toColumnId: string) => Promise<void> | void;
  onReorder?: (itemId: string, columnId: string, newIndex: number) => Promise<void> | void;
  storageKey?: string;
  boardTitle?: ReactNode;
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  className?: string;
  density?: Density;
  onDragEnd?: () => void;
}) {
  const [internalDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "comfortable";
    try {
      const raw = window.localStorage.getItem(`kanban:density:${storageKey ?? "default"}`);
      if (raw === "compact" || raw === "comfortable") return raw;
    } catch { /* noop */ }
    return "comfortable";
  });

  const currentDensity = density ?? internalDensity;

  const dndContextId = useId();

  const [items, setItems] = useState<T[]>(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const itemsByColumn = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const column of columns) {
      map.set(column.id, items.filter((item) => item.columnId === column.id));
    }
    return map;
  }, [items, columns]);

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return getItemById(items, activeId) ?? null;
  }, [activeId, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setDragOverColumn(null);
      return;
    }
    const activeItemData = getItemById(items, String(active.id));
    if (!activeItemData) return;

    const overId = String(over.id);
    const targetColumn = columns.find((col) => col.id === overId || itemsByColumn.get(col.id)?.some((item) => String(item.id) === overId));
    if (targetColumn) {
      setDragOverColumn(targetColumn.id);
    } else {
      setDragOverColumn(null);
    }
  }, [items, columns, itemsByColumn]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDragOverColumn(null);

    if (!over) {
      onDragEnd?.();
      return;
    }

    const activeIdStr = String(active.id);
    const activeItemData = getItemById(items, activeIdStr);
    if (!activeItemData) {
      onDragEnd?.();
      return;
    }

    const overId = String(over.id);
    const overColumn = columns.find((col) => col.id === overId);
    const overItem = getItemById(items, overId);

    const targetColumnId = overColumn?.id ?? overItem?.columnId ?? activeItemData.columnId;
    if (!targetColumnId) {
      onDragEnd?.();
      return;
    }

    if (activeItemData.columnId === targetColumnId) {
      if (!overItem) {
        onDragEnd?.();
        return;
      }

      const columnItems = itemsByColumn.get(activeItemData.columnId) ?? [];
      const activeIndex = columnItems.findIndex((item) => String(item.id) === activeIdStr);
      const targetIndex = columnItems.findIndex((item) => String(item.id) === overId);

      if (activeIndex === targetIndex || activeIndex < 0 || targetIndex < 0) {
        onDragEnd?.();
        return;
      }

      const snapshot = items;
      const reordered = [...columnItems];
      const [moved] = reordered.splice(activeIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      setItems((current) => {
        const next = [...current];
        let writeIndex = 0;
        return next.map((item) => {
          if (item.columnId === targetColumnId) {
            const replacement = reordered[writeIndex];
            writeIndex += 1;
            if (replacement) {
              return replacement;
            }
          }
          return item;
        });
      });

      try {
        await onReorder?.(activeIdStr, targetColumnId, targetIndex);
      } catch {
        setItems(snapshot);
      }
      onDragEnd?.();
      return;
    }

    if (activeItemData.columnId !== targetColumnId) {
      const snapshot = items;
      setItems((current) =>
        current.map((item) =>
          String(item.id) === activeIdStr ? { ...item, columnId: targetColumnId } : item,
        ),
      );

      try {
        await onMove?.(activeIdStr, activeItemData.columnId, targetColumnId);
      } catch {
        setItems(snapshot);
      }
      onDragEnd?.();
      return;
    }

    onDragEnd?.();
  }, [items, columns, itemsByColumn, onMove, onReorder, onDragEnd]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setDragOverColumn(null);
    onDragEnd?.();
  }, [onDragEnd]);

  return (
    <div className={`flex min-h-0 flex-col ${className ?? ""}`}>
      {(boardTitle || toolbar) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {boardTitle && <div>{boardTitle}</div>}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <DndContext
        id={dndContextId}
        sensors={sensors}
        collisionDetection={COLLISION_STRATEGY}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-3 [scrollbar-color:var(--admin-primary)_transparent]">
          {columns.map((column) => {
            const columnItems = itemsByColumn.get(column.id) ?? [];
            const isOver = dragOverColumn === column.id && activeId !== column.id;

            return (
              <KanbanColumn
                key={column.id}
                column={column}
                items={columnItems}
                density={currentDensity}
                isDragOver={isOver}
                renderItem={renderItem}
                renderEmpty={emptyState}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={{
          duration: 180,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        }}>
          {activeItem && renderOverlay ? (
            <div className="rotate-1 scale-[1.02] opacity-90 shadow-2xl shadow-black/40">
              {renderOverlay(activeItem)}
            </div>
          ) : activeItem && !renderOverlay ? (
            <div className="rotate-1 scale-[1.02] opacity-90 shadow-2xl shadow-black/40">
              {renderItem(activeItem, currentDensity, true)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn<T extends BoardItem>({
  column,
  items,
  density,
  isDragOver,
  renderItem,
  renderEmpty,
}: {
  column: BoardColumn;
  items: T[];
  density: Density;
  isDragOver: boolean;
  renderItem: (item: T, density: Density, isDragging: boolean) => ReactNode;
  renderEmpty?: ReactNode;
}) {
  return (
    <section
      className={`flex max-h-[calc(100dvh-16rem)] min-w-[min(82vw,300px)] shrink-0 flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
        isDragOver
          ? "border-[var(--admin-primary)]/60 bg-[var(--admin-primary-soft)] shadow-[0_0_0_3px_var(--admin-primary-soft)]"
          : "border-[var(--admin-border)] bg-[var(--admin-surface-subtle)] shadow-[var(--admin-shadow-sm)]"
      }`}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          {column.icon && <span className="text-[var(--admin-primary)]">{column.icon}</span>}
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">{column.title}</h3>
        </div>
        <span className="rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-elevated)] px-2 py-0.5 text-[10px] font-bold text-zinc-400">
          <NumberFlow value={items.length} />
        </span>
      </header>

      <div className="admin-custom-scroll flex-1 overflow-y-auto overscroll-contain p-2.5">
        {items.length === 0 && !isDragOver ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] p-4 text-center">
            {renderEmpty ?? (
              <p className="text-xs text-zinc-500">Sin pedidos</p>
            )}
          </div>
        ) : (
          <SortableContext items={items.map((item) => String(item.id))} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((item) => (
                <SortableItem key={String(item.id)} item={item}>
                  {(isDragging) => renderItem(item, density, isDragging)}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        )}

        {isDragOver && items.length === 0 && (
          <div className="mt-2 rounded-xl border border-dashed border-[var(--admin-primary)]/50 bg-[var(--admin-primary-soft)]/50 p-4 text-center text-xs font-semibold text-[var(--admin-primary)]">
            Soltar acá
          </div>
        )}
      </div>
    </section>
  );
}

function SortableItem<T extends BoardItem>({
  item,
  children,
}: {
  item: T;
  children: (isDragging: boolean) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(item.id), data: { type: "board-item", item } });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition ?? undefined,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children(isDragging)}
    </div>
  );
}
