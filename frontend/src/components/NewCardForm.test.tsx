import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { NewCardForm } from "@/components/NewCardForm";

describe("NewCardForm", () => {
  it("submits title, details, priority and due date", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);

    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.type(screen.getByPlaceholderText(/card title/i), "Task");
    await userEvent.type(screen.getByPlaceholderText(/details/i), "Notes");
    await userEvent.selectOptions(screen.getByLabelText(/priority/i), "high");

    await userEvent.click(screen.getByRole("button", { name: /add card/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Task", details: "Notes", priority: "high" })
    );
  });

  it("ignores empty titles", async () => {
    const onAdd = vi.fn();
    render(<NewCardForm onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: /add a card/i }));
    await userEvent.click(screen.getByRole("button", { name: /add card/i }));
    expect(onAdd).not.toHaveBeenCalled();
  });
});
