"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import * as api from "@/lib/api";

type AccountDialogProps = {
  username: string | null;
  onClose: () => void;
};

export const AccountDialog = ({ username, onClose }: AccountDialogProps) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setDone(false);
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    "mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Account settings"
        aria-modal="true"
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-6 shadow-[var(--shadow)]"
      >
        <h3 className="font-display text-lg font-semibold text-[var(--navy-dark)]">Account</h3>
        <p className="mt-1 text-sm text-[var(--gray-text)]">
          Signed in as <span className="font-semibold text-[var(--navy-dark)]">{username ?? "—"}</span>
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Current password
            </span>
            <input
              ref={firstRef}
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              New password
            </span>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]">
              Confirm new password
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldClass}
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {done ? <p className="text-sm text-emerald-600">Password updated.</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
            >
              Update password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
