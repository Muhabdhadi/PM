export type Priority = "low" | "medium" | "high";

export type Card = {
  id: string;
  title: string;
  details: string;
  priority?: Priority;
  dueDate?: string;
  labels?: string[];
  assignee?: string;
};

export const PRIORITIES: Priority[] = ["low", "medium", "high"];

export const priorityStyles: Record<Priority, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
};

export type CardFilter = {
  query: string;
  priority: Priority | "";
  label: string;
};

export const emptyFilter: CardFilter = { query: "", priority: "", label: "" };

export const isFilterActive = (filter: CardFilter): boolean =>
  Boolean(filter.query.trim() || filter.priority || filter.label);

export const cardMatchesFilter = (card: Card, filter: CardFilter): boolean => {
  const query = filter.query.trim().toLowerCase();
  if (query) {
    const haystack = `${card.title} ${card.details} ${(card.labels ?? []).join(" ")}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filter.priority && card.priority !== filter.priority) return false;
  if (filter.label && !(card.labels ?? []).includes(filter.label)) return false;
  return true;
};

export const collectLabels = (board: BoardData): string[] => {
  const labels = new Set<string>();
  Object.values(board.cards).forEach((card) =>
    (card.labels ?? []).forEach((label) => labels.add(label))
  );
  return Array.from(labels).sort();
};

export type BoardStats = {
  total: number;
  overdue: number;
  done: number;
};

export const getBoardStats = (board: BoardData): BoardStats => {
  const cards = Object.values(board.cards);
  const doneColumn = board.columns.find((c) => /done/i.test(c.title));
  const doneIds = new Set(doneColumn?.cardIds ?? []);
  return {
    total: cards.length,
    overdue: cards.filter((c) => isOverdue(c.dueDate)).length,
    done: cards.filter((c) => doneIds.has(c.id)).length,
  };
};

export const isOverdue = (dueDate?: string): boolean => {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

export const initialData: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    {
      id: "col-progress",
      title: "In Progress",
      cardIds: ["card-4", "card-5"],
    },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
};

const isColumnId = (columns: Column[], id: string) =>
  columns.some((column) => column.id === id);

export const findColumnId = (columns: Column[], id: string) => {
  if (isColumnId(columns, id)) {
    return id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);

  if (!activeColumnId || !overColumnId) {
    return columns;
  }

  const activeColumn = columns.find((column) => column.id === activeColumnId);
  const overColumn = columns.find((column) => column.id === overColumnId);

  if (!activeColumn || !overColumn) {
    return columns;
  }

  const isOverColumn = isColumnId(columns, overId);

  if (activeColumnId === overColumnId) {
    if (isOverColumn) {
      const nextCardIds = activeColumn.cardIds.filter(
        (cardId) => cardId !== activeId
      );
      nextCardIds.push(activeId);
      return columns.map((column) =>
        column.id === activeColumnId
          ? { ...column, cardIds: nextCardIds }
          : column
      );
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return columns;
    }

    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);

    return columns.map((column) =>
      column.id === activeColumnId
        ? { ...column, cardIds: nextCardIds }
        : column
    );
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) {
    return columns;
  }

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    const insertIndex = overIndex === -1 ? nextOverCardIds.length : overIndex;
    nextOverCardIds.splice(insertIndex, 0, activeId);
  }

  return columns.map((column) => {
    if (column.id === activeColumnId) {
      return { ...column, cardIds: nextActiveCardIds };
    }
    if (column.id === overColumnId) {
      return { ...column, cardIds: nextOverCardIds };
    }
    return column;
  });
};

export const getCardPosition = (columns: Column[], cardId: string) => {
  const column = columns.find((column) => column.cardIds.includes(cardId));
  if (!column) {
    return -1;
  }
  return column.cardIds.indexOf(cardId);
};

export const createId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID()}`;
