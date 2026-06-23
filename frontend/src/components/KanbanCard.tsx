import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { isOverdue, priorityStyles, type Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue = isOverdue(card.dueDate);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "cursor-grab touch-none rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details ? (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--gray-text)]">
              {card.details}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(card.id)}
            className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
            aria-label={`Edit ${card.title}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
            aria-label={`Delete ${card.title}`}
          >
            Remove
          </button>
        </div>
      </div>

      {(card.priority ||
        card.dueDate ||
        card.assignee ||
        (card.comments && card.comments.length > 0) ||
        (card.labels && card.labels.length > 0)) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {card.priority ? (
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                priorityStyles[card.priority]
              )}
            >
              {card.priority}
            </span>
          ) : null}
          {card.dueDate ? (
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                overdue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
              )}
            >
              {overdue ? "Overdue " : "Due "}
              {card.dueDate}
            </span>
          ) : null}
          {(card.labels ?? []).map((label) => (
            <span
              key={label}
              className="rounded-full bg-[var(--primary-blue)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--primary-blue)]"
            >
              {label}
            </span>
          ))}
          {card.comments && card.comments.length > 0 ? (
            <span
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
              title={`${card.comments.length} comment(s)`}
            >
              💬 {card.comments.length}
            </span>
          ) : null}
          {card.assignee ? (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--secondary-purple)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--secondary-purple)]"
              title={`Assigned to ${card.assignee}`}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-[8px] text-white">
                {card.assignee.charAt(0).toUpperCase()}
              </span>
              {card.assignee}
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
};
