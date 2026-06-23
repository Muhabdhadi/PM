import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listBoards: vi.fn(),
    getBoard: vi.fn(),
    createBoard: vi.fn(),
    renameBoard: vi.fn(),
    deleteBoard: vi.fn(),
    saveBoard: vi.fn(),
    logout: vi.fn(),
  };
});

import Workspace from "@/components/Workspace";
import * as api from "@/lib/api";
import { initialData } from "@/lib/kanban";

const boards = [
  { id: 1, name: "My Board", position: 0, created_at: "", updated_at: "" },
  { id: 2, name: "Roadmap", position: 1, created_at: "", updated_at: "" },
];

describe("Workspace", () => {
  beforeEach(() => {
    (api.listBoards as Mock).mockResolvedValue({ boards });
    (api.getBoard as Mock).mockResolvedValue({ board: initialData, boardId: 1, name: "My Board" });
    (api.createBoard as Mock).mockResolvedValue({ status: "ok", board: { id: 3, name: "New" } });
  });

  afterEach(() => vi.clearAllMocks());

  it("loads boards and renders the active board name", async () => {
    render(<Workspace username="user" />);
    expect(await screen.findByTestId("board-tab-1")).toBeInTheDocument();
    expect(screen.getByTestId("board-tab-2")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "My Board" }).length).toBeGreaterThan(0);
  });

  it("creates a board through the sidebar", async () => {
    render(<Workspace username="user" />);
    await screen.findByTestId("board-tab-1");

    await userEvent.click(screen.getAllByRole("button", { name: /new board/i })[0]);
    const input = screen.getAllByLabelText("New board name")[0];
    await userEvent.type(input, "Sprint{enter}");

    await waitFor(() => expect(api.createBoard as Mock).toHaveBeenCalledWith("Sprint"));
  });
});
