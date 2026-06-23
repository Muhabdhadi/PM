"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import type { ActivityEntry } from "@/lib/api";

type ActivityDialogProps = {
  boardId: number;
  onClose: () => void;
};

export const ActivityDialog = ({ boardId, onClose }: ActivityDialogProps) => {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let mounted = true;
    api
      .listActivity(boardId)
      .then((d) => mounted && setEntries(d.activity))
      .catch(() => mounted && setEntries([]));
    return () => {
      mounted = false;
    };
  }, [boardId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Board activity"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
      >
        <h3 className="font-display text-lg font-semibold text-[var(--navy-dark)]">Activity</h3>

        {entries === null ? (
          <p className="mt-4 text-sm text-[var(--gray-text)]">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--gray-text)]">No activity yet.</p>
        ) : (
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {entries.map((e, i) => (
              <li key={i} className="rounded-xl bg-[var(--surface)] px-3 py-2 text-sm">
                <span className="font-semibold text-[var(--navy-dark)]">{e.actor}</span>{" "}
                <span className="text-[var(--gray-text)]">{e.action}</span>
                <div className="mt-0.5 text-[10px] text-[var(--gray-text)]">
                  {new Date(e.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
