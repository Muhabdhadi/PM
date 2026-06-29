"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { CardEditor, type CardPatch } from "@/components/CardEditor";
import { ActivityDialog } from "@/components/ActivityDialog";
import type { NewCardInput } from "@/components/NewCardForm";
import ChatSidebar from "@/components/ChatSidebar";
import * as api from "@/lib/api";
import { FilterBar } from "@/components/FilterBar";
import {
  cardMatchesFilter,
  collectAssignees,
  collectLabels,
  createId,
  emptyFilter,
  findColumnId,
  getBoardStats,
  getCardPosition,
  initialData,
  isFilterActive,
  moveCard,
  type BoardData,
  type CardFilter,
} from "@/lib/kanban";

type KanbanBoardProps = {
  boardId?: number;
};

export const KanbanBoard = ({ boardId }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CardFilter>(emptyFilter);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [showActivity, setShowActivity] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    })
  );

  const router = useRouter();

  const persistBoard = async (nextBoard: BoardData) => {
    try {
      await api.saveBoard(nextBoard, boardId);
    } catch (err) {
      console.error("Failed to save board:", err);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) return;

    const prevBoard = board;
    const nextColumns = moveCard(board.columns, active.id as string, over.id as string);
    const nextBoard = { ...board, columns: nextColumns };
    setBoard(nextBoard);

    const newColumnId = findColumnId(nextColumns, active.id as string);
    const position = getCardPosition(nextColumns, active.id as string);

    if (newColumnId && position !== -1) {
      try {
        const res = await api.updateCard(
          active.id as string,
          { columnId: newColumnId, position },
          boardId
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error("Failed to persist card move:", err);
        setBoard(prevBoard);
      }
    }
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => {
      const nextBoard = {
        ...prev,
        columns: prev.columns.map((column) =>
          column.id === columnId ? { ...column, title } : column
        ),
      };
      persistBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleAddCard = (columnId: string, input: NewCardInput) => {
    const id = createId("card");
    const newCard = {
      id,
      title: input.title,
      details: input.details || "No details yet.",
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    };

    setBoard((prev) => ({
      ...prev,
      cards: { ...prev.cards, [id]: newCard },
      columns: prev.columns.map((col) =>
        col.id === columnId ? { ...col, cardIds: [...col.cardIds, id] } : col
      ),
    }));

    api.createCard({ ...newCard, columnId }, boardId).catch((err) => {
      console.error("Failed to persist card create:", err);
      setBoard((prev) => ({
        ...prev,
        cards: Object.fromEntries(Object.entries(prev.cards).filter(([k]) => k !== id)),
        columns: prev.columns.map((col) =>
          col.id === columnId
            ? { ...col, cardIds: col.cardIds.filter((cid) => cid !== id) }
            : col
        ),
      }));
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    const deletedCard = board.cards[cardId];

    setBoard((prev) => ({
      ...prev,
      cards: Object.fromEntries(Object.entries(prev.cards).filter(([id]) => id !== cardId)),
      columns: prev.columns.map((col) =>
        col.id === columnId
          ? { ...col, cardIds: col.cardIds.filter((id) => id !== cardId) }
          : col
      ),
    }));

    api.deleteCard(cardId, boardId).catch((err) => {
      console.error("Failed to persist card delete:", err);
      if (deletedCard) {
        setBoard((prev) => ({
          ...prev,
          cards: { ...prev.cards, [cardId]: deletedCard },
          columns: prev.columns.map((col) =>
            col.id === columnId
              ? { ...col, cardIds: [...col.cardIds, cardId] }
              : col
          ),
        }));
      }
    });
  };

  const handleUpdateCard = (cardId: string, patch: CardPatch) => {
    const prevBoard = board;
    setBoard((prev) => {
      const existing = prev.cards[cardId];
      if (!existing) return prev;
      const next = { ...existing };
      if (patch.title !== undefined) next.title = patch.title;
      if (patch.details !== undefined) next.details = patch.details;
      if (patch.priority !== undefined) {
        if (patch.priority) next.priority = patch.priority;
        else delete next.priority;
      }
      if (patch.dueDate !== undefined) {
        if (patch.dueDate) next.dueDate = patch.dueDate;
        else delete next.dueDate;
      }
      if (patch.labels !== undefined) {
        if (patch.labels.length) next.labels = patch.labels;
        else delete next.labels;
      }
      if (patch.assignee !== undefined) {
        if (patch.assignee) next.assignee = patch.assignee;
        else delete next.assignee;
      }
      return { ...prev, cards: { ...prev.cards, [cardId]: next } };
    });

    api
      .updateCard(
        cardId,
        {
          title: patch.title,
          details: patch.details,
          priority: patch.priority,
          dueDate: patch.dueDate,
          labels: patch.labels,
          assignee: patch.assignee,
        },
        boardId
      )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch((err) => {
        console.error("Failed to persist card update:", err);
        setBoard(prevBoard);
      });
  };

  const handleAddComment = async (cardId: string, text: string) => {
    try {
      const { comment } = await api.addComment(cardId, text, boardId);
      setBoard((prev) => {
        const existing = prev.cards[cardId];
        if (!existing) return prev;
        const next = {
          ...existing,
          comments: [...(existing.comments ?? []), comment],
        };
        return { ...prev, cards: { ...prev.cards, [cardId]: next } };
      });
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleAddColumn = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const id = createId("col");
    setBoard((prev) => {
      const nextBoard = {
        ...prev,
        columns: [...prev.columns, { id, title: trimmed, cardIds: [] }],
      };
      persistBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleDeleteColumn = (columnId: string) => {
    setBoard((prev) => {
      const column = prev.columns.find((c) => c.id === columnId);
      if (!column || column.cardIds.length > 0) return prev;
      const nextBoard = {
        ...prev,
        columns: prev.columns.filter((c) => c.id !== columnId),
      };
      persistBoard(nextBoard);
      return nextBoard;
    });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.getBoard(boardId);
        if (!mounted) return;
        if (data && data.board) {
          setBoard(data.board as BoardData);
        }
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        // network failure — keep existing data
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, boardId]);

  const activeCard = activeCardId ? board.cards[activeCardId] ?? null : null;
  const editingCard = editingCardId ? board.cards[editingCardId] ?? null : null;
  const labels = useMemo(() => collectLabels(board), [board]);
  const assignees = useMemo(() => collectAssignees(board), [board]);
  const stats = useMemo(() => getBoardStats(board), [board]);
  const filtering = isFilterActive(filter);
  const visibleCount = useMemo(
    () =>
      filtering
        ? Object.values(board.cards).filter((c) => cardMatchesFilter(c, filter)).length
        : stats.total,
    [board.cards, filter, filtering, stats.total]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
          <span className="rounded-full bg-[var(--surface)] px-3 py-1.5">{stats.total} cards</span>
          <span className="rounded-full bg-[var(--surface)] px-3 py-1.5">{stats.done} done</span>
          {stats.overdue > 0 && (
            <span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-700">
              {stats.overdue} overdue
            </span>
          )}
          {boardId != null && (
            <button
              type="button"
              onClick={() => setShowActivity(true)}
              className="rounded-full bg-[var(--surface)] px-3 py-1.5 transition hover:text-[var(--navy-dark)]"
            >
              Activity
            </button>
          )}
        </div>
        <FilterBar filter={filter} labels={labels} assignees={assignees} onChange={setFilter} />
      </div>

      {filtering && visibleCount === 0 ? (
        <p
          role="status"
          className="mb-4 rounded-xl border border-dashed border-[var(--stroke)] px-4 py-3 text-sm text-[var(--gray-text)]"
        >
          No cards match your filters.
        </p>
      ) : null}

      <div className="flex items-start gap-4 overflow-x-auto pb-4 sm:gap-5 lg:gap-6">
        {board.columns.map((column) => (
          <div key={column.id} className="w-[80vw] shrink-0 sm:w-[300px] lg:w-[280px]">
            <KanbanColumn
              column={column}
              cards={column.cardIds
                .map((cardId) => board.cards[cardId])
                .filter(Boolean)
                .filter((card) => !filtering || cardMatchesFilter(card, filter))}
              onRename={handleRenameColumn}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
              onEditCard={setEditingCardId}
              onDeleteColumn={handleDeleteColumn}
              canDelete={board.columns.length > 1 && column.cardIds.length === 0}
            />
          </div>
        ))}

        <div className="w-[70vw] shrink-0 sm:w-[260px] lg:w-[240px]">
          {addingColumn ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddColumn(newColumnTitle);
                setNewColumnTitle("");
                setAddingColumn(false);
              }}
              className="rounded-3xl border border-dashed border-[var(--stroke)] bg-[var(--surface-strong)] p-4"
            >
              <input
                autoFocus
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                onBlur={() => !newColumnTitle.trim() && setAddingColumn(false)}
                placeholder="Column title"
                aria-label="New column title"
                className="w-full rounded-xl border border-[var(--primary-blue)] px-3 py-2 text-sm outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className="w-full rounded-3xl border border-dashed border-[var(--stroke)] px-4 py-6 text-sm font-semibold text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
            >
              + Add column
            </button>
          )}
        </div>
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="w-[260px]">
            <KanbanCardPreview card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
      <ChatSidebar board={board} boardId={boardId} onApplyBoard={(b) => setBoard(b)} />

      {editingCard ? (
        <CardEditor
          card={editingCard}
          onSave={(patch) => handleUpdateCard(editingCard.id, patch)}
          onAddComment={(text) => handleAddComment(editingCard.id, text)}
          onDelete={() => {
            const columnId = board.columns.find((c) =>
              c.cardIds.includes(editingCard.id)
            )?.id;
            if (columnId) handleDeleteCard(columnId, editingCard.id);
            setEditingCardId(null);
          }}
          onClose={() => setEditingCardId(null)}
        />
      ) : null}

      {showActivity && boardId != null ? (
        <ActivityDialog boardId={boardId} onClose={() => setShowActivity(false)} />
      ) : null}
    </DndContext>
  );
};
