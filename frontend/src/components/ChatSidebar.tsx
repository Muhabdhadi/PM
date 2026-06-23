"use client";

import { useState } from "react";
import type { BoardData } from "@/lib/kanban";

type Message = { role: "user" | "assistant"; text: string };

export default function ChatSidebar({
  board,
  boardId,
  onApplyBoard,
}: {
  board: BoardData;
  boardId?: number;
  onApplyBoard: (b: BoardData) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const send = async () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userText, board, board_id: boardId }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      const aiText =
        data.response ||
        (typeof data.output === "string" ? data.output : JSON.stringify(data.output));
      setMessages((m) => [...m, { role: "assistant", text: aiText }]);
      if (data.boardUpdate) {
        onApplyBoard(data.boardUpdate as BoardData);
      } else if (data.board) {
        onApplyBoard(data.board as BoardData);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "(AI call failed)" }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-blue)] text-white shadow-[var(--shadow)] transition hover:brightness-110"
      >
        AI
      </button>
    );
  }

  return (
    <aside className="fixed inset-x-4 bottom-4 z-30 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] backdrop-blur sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[360px]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--navy-dark)]">AI Assistant</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Minimize AI assistant"
          className="rounded-full px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          —
        </button>
      </div>
      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-[var(--gray-text)]">
            Ask me to add cards, reshuffle columns, or summarize this board.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "text-right text-sm text-[var(--navy-dark)]"
                  : "text-left text-sm text-[var(--gray-text)]"
              }
            >
              <div>{m.text}</div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
          placeholder="Ask the AI or request a board update"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          disabled={loading}
          onClick={send}
          className="rounded-lg bg-[var(--primary-blue)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </aside>
  );
}
