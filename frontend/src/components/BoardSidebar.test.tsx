import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { BoardSidebar } from "@/components/BoardSidebar";
import type { BoardSummary } from "@/lib/api";

const boards: BoardSummary[] = [
  { id: 1, name: "My Board", position: 0, created_at: "", updated_at: "" },
  { id: 2, name: "Roadmap", position: 1, created_at: "", updated_at: "" },
];

const noop = () => {};

const renderSidebar = (overrides: Partial<Parameters<typeof BoardSidebar>[0]> = {}) => {
  const props = {
    boards,
    activeId: 1,
    username: "user",
    onSwitch: noop,
    onCreate: noop,
    onRename: noop,
    onDelete: noop,
    onShare: noop,
    onLogout: noop,
    ...overrides,
  };
  render(<BoardSidebar {...props} />);
  return props;
};

describe("BoardSidebar", () => {
  it("renders all boards and the username", () => {
    renderSidebar();
    expect(screen.getByText("My Board")).toBeInTheDocument();
    expect(screen.getByText("Roadmap")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  it("switches boards on click", async () => {
    const onSwitch = vi.fn();
    renderSidebar({ onSwitch });
    await userEvent.click(screen.getByTestId("board-tab-2"));
    expect(onSwitch).toHaveBeenCalledWith(2);
  });

  it("creates a new board", async () => {
    const onCreate = vi.fn();
    renderSidebar({ onCreate });
    await userEvent.click(screen.getByRole("button", { name: /new board/i }));
    const input = screen.getByLabelText("New board name");
    await userEvent.type(input, "Sprint 5");
    fireEvent.submit(input);
    expect(onCreate).toHaveBeenCalledWith("Sprint 5");
  });

  it("renames a board", async () => {
    const onRename = vi.fn();
    renderSidebar({ onRename });
    await userEvent.click(screen.getByRole("button", { name: /rename roadmap/i }));
    const input = screen.getByLabelText("Board name");
    await userEvent.clear(input);
    await userEvent.type(input, "Q4 Roadmap");
    fireEvent.submit(input);
    expect(onRename).toHaveBeenCalledWith(2, "Q4 Roadmap");
  });

  it("disables delete when only one board remains", () => {
    renderSidebar({
      boards: [boards[0]],
      onDelete: vi.fn(),
    });
    expect(screen.getByRole("button", { name: /delete my board/i })).toBeDisabled();
  });

  it("logs out", async () => {
    const onLogout = vi.fn();
    renderSidebar({ onLogout });
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onLogout).toHaveBeenCalled();
  });

  it("shares an owned board", async () => {
    const onShare = vi.fn();
    renderSidebar({ onShare });
    await userEvent.click(screen.getByRole("button", { name: /share roadmap/i }));
    expect(onShare).toHaveBeenCalledWith(2);
  });

  it("hides owner-only actions for shared boards", () => {
    renderSidebar({
      boards: [
        { id: 9, name: "Team Board", position: 0, created_at: "", updated_at: "", role: "editor", owner: "alice" },
      ],
      activeId: 9,
    });
    expect(screen.getByText(/shared by alice/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rename team board/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete team board/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share team board/i })).not.toBeInTheDocument();
  });
});
