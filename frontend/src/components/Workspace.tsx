"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard } from "@/components/KanbanBoard";
import { BoardSidebar } from "@/components/BoardSidebar";
import { ShareDialog } from "@/components/ShareDialog";
import * as api from "@/lib/api";
import type { BoardSummary } from "@/lib/api";

export default function Workspace({ username }: { username: string | null }) {
  const router = useRouter();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharingBoardId, setSharingBoardId] = useState<number | null>(null);

  const refreshBoards = useCallback(
    async (preferredId?: number) => {
      const { boards: list } = await api.listBoards();
      setBoards(list);
      setActiveId((current) => {
        if (preferredId && list.some((b) => b.id === preferredId)) return preferredId;
        if (current && list.some((b) => b.id === current)) return current;
        return list[0]?.id ?? null;
      });
      return list;
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshBoards();
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 401) {
          router.replace("/login");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshBoards, router]);

  const handleLogout = async () => {
    await api.logout();
    router.replace("/login");
  };

  const handleCreate = async (name: string) => {
    const { board } = await api.createBoard(name);
    await refreshBoards(board.id);
    setDrawerOpen(false);
  };

  const handleRename = async (id: number, name: string) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
    await api.renameBoard(id, name);
  };

  const handleDelete = async (id: number) => {
    await api.deleteBoard(id);
    const list = await refreshBoards();
    if (id === activeId) setActiveId(list[0]?.id ?? null);
  };

  const handleSwitch = (id: number) => {
    setActiveId(id);
    setDrawerOpen(false);
  };

  const activeBoard = boards.find((b) => b.id === activeId) ?? null;

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--stroke)] bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open boards menu"
          className="rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm font-semibold text-[var(--navy-dark)]"
        >
          ☰
        </button>
        <h1 className="truncate font-display text-lg font-semibold text-[var(--navy-dark)]">
          {activeBoard?.name ?? "Kanban Studio"}
        </h1>
        <span className="w-9" />
      </header>

      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-[var(--stroke)] bg-white/70 p-6 lg:block lg:h-screen lg:sticky lg:top-0">
          <BoardSidebar
            boards={boards}
            activeId={activeId}
            username={username}
            onSwitch={handleSwitch}
            onCreate={handleCreate}
            onRename={handleRename}
            onDelete={handleDelete}
            onShare={setSharingBoardId}
            onLogout={handleLogout}
          />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setDrawerOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white p-6 shadow-xl">
              <BoardSidebar
                boards={boards}
                activeId={activeId}
                username={username}
                onSwitch={handleSwitch}
                onCreate={handleCreate}
                onRename={handleRename}
                onDelete={handleDelete}
                onShare={setSharingBoardId}
                onLogout={handleLogout}
              />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-10">
          <div className="mb-6 hidden items-center justify-between lg:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Kanban Studio
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-[var(--navy-dark)]">
                {activeBoard?.name ?? "Board"}
              </h2>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--gray-text)]">Loading boards…</p>
          ) : activeId ? (
            <KanbanBoard key={activeId} boardId={activeId} />
          ) : (
            <p className="text-sm text-[var(--gray-text)]">No board selected.</p>
          )}
        </main>
      </div>

      {sharingBoardId != null && (
        <ShareDialog
          boardId={sharingBoardId}
          boardName={boards.find((b) => b.id === sharingBoardId)?.name ?? "board"}
          onClose={() => setSharingBoardId(null)}
        />
      )}
    </div>
  );
}
