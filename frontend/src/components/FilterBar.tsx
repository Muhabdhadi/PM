"use client";

import { PRIORITIES, capitalize, emptyFilter, isFilterActive, type CardFilter, type Priority } from "@/lib/kanban";

type FilterBarProps = {
  filter: CardFilter;
  labels: string[];
  assignees?: string[];
  onChange: (filter: CardFilter) => void;
};

export const FilterBar = ({ filter, labels, assignees = [], onChange }: FilterBarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={filter.query}
        onChange={(e) => onChange({ ...filter, query: e.target.value })}
        placeholder="Search cards…"
        aria-label="Search cards"
        className="min-w-0 flex-1 rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)] sm:max-w-xs"
      />

      <select
        value={filter.priority}
        onChange={(e) => onChange({ ...filter, priority: e.target.value as Priority | "" })}
        aria-label="Filter by priority"
        className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
      >
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {capitalize(p)}
          </option>
        ))}
      </select>

      {labels.length > 0 && (
        <select
          value={filter.label}
          onChange={(e) => onChange({ ...filter, label: e.target.value })}
          aria-label="Filter by label"
          className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
        >
          <option value="">All labels</option>
          {labels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      )}

      {assignees.length > 0 && (
        <select
          value={filter.assignee}
          onChange={(e) => onChange({ ...filter, assignee: e.target.value })}
          aria-label="Filter by assignee"
          className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary-blue)]"
        >
          <option value="">All assignees</option>
          {assignees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}

      {isFilterActive(filter) && (
        <button
          type="button"
          onClick={() => onChange(emptyFilter)}
          className="rounded-xl border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Clear
        </button>
      )}
    </div>
  );
};
