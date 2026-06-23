import {
  cardMatchesFilter,
  collectLabels,
  getBoardStats,
  isFilterActive,
  isOverdue,
  moveCard,
  type BoardData,
  type Card,
  type CardFilter,
  type Column,
} from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });
});

describe("isOverdue", () => {
  it("returns false for empty or invalid dates", () => {
    expect(isOverdue(undefined)).toBe(false);
    expect(isOverdue("")).toBe(false);
    expect(isOverdue("not-a-date")).toBe(false);
  });

  it("returns true for a past date and false for a future date", () => {
    expect(isOverdue("2000-01-01")).toBe(true);
    expect(isOverdue("2999-01-01")).toBe(false);
  });
});

describe("card filtering", () => {
  const card: Card = {
    id: "c1",
    title: "Ship release",
    details: "final QA",
    priority: "high",
    labels: ["release", "urgent"],
  };
  const base: CardFilter = { query: "", priority: "", label: "" };

  it("matches on title, details and labels", () => {
    expect(cardMatchesFilter(card, { ...base, query: "ship" })).toBe(true);
    expect(cardMatchesFilter(card, { ...base, query: "qa" })).toBe(true);
    expect(cardMatchesFilter(card, { ...base, query: "urgent" })).toBe(true);
    expect(cardMatchesFilter(card, { ...base, query: "nope" })).toBe(false);
  });

  it("matches on priority and label", () => {
    expect(cardMatchesFilter(card, { ...base, priority: "high" })).toBe(true);
    expect(cardMatchesFilter(card, { ...base, priority: "low" })).toBe(false);
    expect(cardMatchesFilter(card, { ...base, label: "release" })).toBe(true);
    expect(cardMatchesFilter(card, { ...base, label: "missing" })).toBe(false);
  });

  it("detects active filters", () => {
    expect(isFilterActive(base)).toBe(false);
    expect(isFilterActive({ ...base, query: "x" })).toBe(true);
    expect(isFilterActive({ ...base, priority: "low" })).toBe(true);
  });
});

describe("board aggregates", () => {
  const board: BoardData = {
    columns: [
      { id: "col-backlog", title: "Backlog", cardIds: ["c1", "c2"] },
      { id: "col-done", title: "Done", cardIds: ["c3"] },
    ],
    cards: {
      c1: { id: "c1", title: "A", details: "", labels: ["x"], dueDate: "2000-01-01" },
      c2: { id: "c2", title: "B", details: "", labels: ["y", "x"] },
      c3: { id: "c3", title: "C", details: "" },
    },
  };

  it("collects unique sorted labels", () => {
    expect(collectLabels(board)).toEqual(["x", "y"]);
  });

  it("computes totals, done and overdue counts", () => {
    const stats = getBoardStats(board);
    expect(stats.total).toBe(3);
    expect(stats.done).toBe(1);
    expect(stats.overdue).toBe(1);
  });
});
