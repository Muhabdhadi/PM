"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PRIORITIES, type Card, type Priority } from "@/lib/kanban";

export type CardPatch = {
  title?: string;
  details?: string;
  priority?: Priority | null;
  dueDate?: string | null;
  labels?: string[];
  assignee?: string | null;
};

type CardEditorProps = {
  card: Card;
  onSave: (patch: CardPatch) => void;
  onDelete: () => void;
  onClose: () => void;
};

export const CardEditor = ({ card, onSave, onDelete, onClose }: CardEditorProps) => {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority | "">(card.priority ?? "");
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [labels, setLabels] = useState((card.labels ?? []).join(", "));
  const [assignee, setAssignee] = useState(card.assignee ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      details: details.trim(),
      priority: priority === "" ? null : priority,
      dueDate: dueDate ? dueDate : null,
      labels: labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
      assignee: assignee.trim() ? assignee.trim() : null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Edit card"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
      >
        <h3 className="font-display text-lg font-semibold text-[var(--navy-dark)]">Edit card</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Description
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="mt-1 w-full resize-none rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
            />
          </label>

          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="block flex-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Priority
              </span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority | "")}
                className="mt-1 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
              >
                <option value="">None</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block flex-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
                Due date
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Labels (comma separated)
            </span>
            <input
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="design, urgent"
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Assignee
            </span>
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Who owns this?"
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
            />
          </label>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:bg-rose-50"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
