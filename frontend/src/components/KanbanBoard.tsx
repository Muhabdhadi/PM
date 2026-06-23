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
import ChatSidebar from "@/components/ChatSidebar";
import * as api from "@/lib/api";
import {
  createId,
  findColumnId,
  getCardPosition,
  initialData,
  moveCard,
  type BoardData,
} from "@/lib/kanban";

type KanbanBoardProps = {
  boardId?: number;
};

export const KanbanBoard = ({ boardId }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    })
  );

  const router = useRouter();
  const cardsById = useMemo(() => board.cards, [board.cards]);

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

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    const newCard = { id, title, details: details || "No details yet." };

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

  const activeCard = activeCardId ? cardsById[activeCardId] ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 sm:gap-5 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible">
        {board.columns.map((column) => (
          <div key={column.id} className="w-[80vw] shrink-0 sm:w-[300px] lg:w-auto">
            <KanbanColumn
              column={column}
              cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
              onRename={handleRenameColumn}
              onAddCard={handleAddCard}
              onDeleteCard={handleDeleteCard}
            />
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="w-[260px]">
            <KanbanCardPreview card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
      <ChatSidebar board={board} boardId={boardId} onApplyBoard={(b) => setBoard(b)} />
    </DndContext>
  );
};
