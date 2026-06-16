import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ board: initialData }),
    })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders five columns", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = await screen.findAllByTestId(/column-/i).then((columns) => columns[0]);
    const input = within(column).getByLabelText("Column title");
    fireEvent.change(input, { target: { value: "New Name" } });

    await waitFor(() => {
      expect(input).toHaveValue("New Name");
    });
  });

  it("opens the add card form and accepts input", async () => {
    render(<KanbanBoard />);
    const column = await screen.findAllByTestId(/column-/i).then((columns) => columns[0]);
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    fireEvent.click(addButton);

    const titleInput = await screen.findByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    await waitFor(() => expect(titleInput).toHaveValue("New card"));

    const detailsInput = await screen.findByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");
    await waitFor(() => expect(detailsInput).toHaveValue("Notes"));

    expect(screen.getByRole("button", { name: /add card/i })).toBeInTheDocument();
  });
});
