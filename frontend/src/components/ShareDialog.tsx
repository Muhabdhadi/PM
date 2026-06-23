"use client";

import { useEffect, useState, type FormEvent } from "react";
import * as api from "@/lib/api";
import type { BoardMember } from "@/lib/api";

type ShareDialogProps = {
  boardId: number;
  boardName: string;
  onClose: () => void;
};

export const ShareDialog = ({ boardId, boardName, onClose }: ShareDialogProps) => {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let mounted = true;
    api
      .listMembers(boardId)
      .then((d) => mounted && setMembers(d.members))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [boardId]);

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const name = username.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      const { members: next } = await api.addMember(boardId, name);
      setMembers(next);
      setUsername("");
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : "Could not add member");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (memberId: number) => {
    try {
      const { members: next } = await api.removeMember(boardId, memberId);
      setMembers(next);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Share board"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
      >
        <h3 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
          Share “{boardName}”
        </h3>
        <p className="mt-1 text-sm text-[var(--gray-text)]">
          Invite other users by username to collaborate on this board.
        </p>

        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            aria-label="Username to invite"
            className="flex-1 rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[var(--primary-blue)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            Invite
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

        <ul className="mt-5 space-y-2">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-3 py-2"
            >
              <span className="text-sm font-semibold text-[var(--navy-dark)]">
                {m.username}
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                  {m.role}
                </span>
              </span>
              {m.role !== "owner" ? (
                <button
                  type="button"
                  onClick={() => handleRemove(m.user_id)}
                  aria-label={`Remove ${m.username}`}
                  className="text-xs font-semibold text-rose-600 transition hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
