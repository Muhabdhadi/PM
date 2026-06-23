import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { CardEditor } from "@/components/CardEditor";
import type { Card } from "@/lib/kanban";

const card: Card = {
  id: "card-1",
  title: "Old title",
  details: "Old details",
  priority: "low",
  labels: ["a"],
};

describe("CardEditor", () => {
  it("saves edited fields as a patch", async () => {
    const onSave = vi.fn();
    render(
      <CardEditor card={card} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />
    );

    const title = screen.getByDisplayValue("Old title");
    await userEvent.clear(title);
    await userEvent.type(title, "New title");

    await userEvent.selectOptions(screen.getByLabelText(/priority/i), "high");
    await userEvent.clear(screen.getByDisplayValue("a"));
    await userEvent.type(screen.getByLabelText(/labels/i), "x, y");
    await userEvent.type(screen.getByLabelText(/assignee/i), "dana");

    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const patch = onSave.mock.calls[0][0];
    expect(patch.title).toBe("New title");
    expect(patch.priority).toBe("high");
    expect(patch.labels).toEqual(["x", "y"]);
    expect(patch.assignee).toBe("dana");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <CardEditor card={card} onSave={vi.fn()} onDelete={vi.fn()} onClose={onClose} />
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("clears priority when set to none", async () => {
    const onSave = vi.fn();
    render(
      <CardEditor card={card} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    await userEvent.selectOptions(screen.getByLabelText(/priority/i), "");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSave.mock.calls[0][0].priority).toBeNull();
  });

  it("invokes onDelete", async () => {
    const onDelete = vi.fn();
    render(
      <CardEditor card={card} onSave={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("renders existing comments and adds a new one", async () => {
    const onAddComment = vi.fn();
    const withComments = {
      ...card,
      comments: [{ id: "cmt-1", author: "user", text: "Looks good", createdAt: "2026-01-01T00:00:00Z" }],
    };
    render(
      <CardEditor
        card={withComments}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
        onAddComment={onAddComment}
      />
    );
    expect(screen.getByText("Looks good")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/add a comment/i), "On it");
    await userEvent.click(screen.getByRole("button", { name: /^comment$/i }));
    expect(onAddComment).toHaveBeenCalledWith("On it");
  });

  it("hides the comments section without an onAddComment handler", () => {
    render(<CardEditor card={card} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByLabelText(/add a comment/i)).not.toBeInTheDocument();
  });
});
