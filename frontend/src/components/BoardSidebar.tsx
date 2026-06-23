"use client";

import { useState, type FormEvent } from "react";
import clsx from "clsx";
import type { BoardSummary } from "@/lib/api";

type BoardSidebarProps = {
  boards: BoardSummary[];
  activeId: number | null;
  username: string | null;
  onSwitch: (id: number) => void;
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onShare: (id: number) => void;
  onLogout: () => void;
};

const isOwned = (board: BoardSummary) => board.role !== "editor";

export const BoardSidebar = ({
  boards,
  activeId,
  username,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onShare,
  onLogout,
}: BoardSidebarProps) => {
  const ownedCount = boards.filter(isOwned).length;
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onCreate(name);
    setNewName("");
    setCreating(false);
  };

  const submitRename = (event: FormEvent, id: number) => {
    event.preventDefault();
    const name = editName.trim();
    if (name) onRename(id, name);
    setEditingId(null);
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Kanban Studio
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-[var(--navy-dark)]">
          Workspace
        </h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Boards">
        {boards.map((b) => {
          const isActive = b.id === activeId;
          if (editingId === b.id) {
            return (
              <form key={b.id} onSubmit={(e) => submitRename(e, b.id)} className="px-1">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => setEditingId(null)}
                  aria-label="Board name"
                  className="w-full rounded-lg border border-[var(--primary-blue)] px-3 py-2 text-sm outline-none"
                />
              </form>
            );
          }
          return (
            <div
              key={b.id}
              className={clsx(
                "group flex items-center gap-1 rounded-xl px-3 py-2 transition",
                isActive
                  ? "bg-[var(--primary-blue)]/10 text-[var(--navy-dark)]"
                  : "text-[var(--gray-text)] hover:bg-[var(--surface)]"
              )}
            >
              <button
                type="button"
                onClick={() => onSwitch(b.id)}
                className="flex-1 truncate text-left text-sm font-semibold"
                data-testid={`board-tab-${b.id}`}
              >
                {b.name}
                {!isOwned(b) && b.owner ? (
                  <span className="ml-1 block truncate text-[10px] font-normal text-[var(--gray-text)]">
                    shared by {b.owner}
                  </span>
                ) : null}
              </button>
              {isOwned(b) ? (
                <>
                  <button
                    type="button"
                    aria-label={`Share ${b.name}`}
                    onClick={() => onShare(b.id)}
                    className="rounded px-1.5 py-0.5 text-xs opacity-0 transition group-hover:opacity-100"
                  >
                    🔗
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename ${b.name}`}
                    onClick={() => {
                      setEditingId(b.id);
                      setEditName(b.name);
                    }}
                    className="rounded px-1.5 py-0.5 text-xs opacity-0 transition group-hover:opacity-100"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${b.name}`}
                    onClick={() => {
                      if (ownedCount > 1) onDelete(b.id);
                    }}
                    disabled={ownedCount <= 1}
                    className="rounded px-1.5 py-0.5 text-xs opacity-0 transition group-hover:opacity-100 disabled:cursor-not-allowed"
                  >
                    🗑
                  </button>
                </>
              ) : null}
            </div>
          );
        })}

        {creating ? (
          <form onSubmit={submitCreate} className="px-1 pt-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => !newName.trim() && setCreating(false)}
              placeholder="Board name"
              aria-label="New board name"
              className="w-full rounded-lg border border-[var(--primary-blue)] px-3 py-2 text-sm outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-1 rounded-xl border border-dashed border-[var(--stroke)] px-3 py-2 text-left text-sm font-semibold text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)]"
          >
            + New board
          </button>
        )}
      </nav>

      <div className="border-t border-[var(--stroke)] pt-4">
        <p className="truncate text-sm font-semibold text-[var(--navy-dark)]">
          {username ?? "Signed in"}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary-blue)] transition hover:text-[var(--secondary-purple)]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};
