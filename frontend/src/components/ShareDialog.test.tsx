import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    listMembers: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  };
});

import { ShareDialog } from "@/components/ShareDialog";
import * as api from "@/lib/api";

const owner = { user_id: 1, username: "user", role: "owner" };
const collab = { user_id: 2, username: "collab", role: "editor" };

describe("ShareDialog", () => {
  beforeEach(() => {
    (api.listMembers as Mock).mockResolvedValue({ members: [owner] });
    (api.addMember as Mock).mockResolvedValue({ status: "ok", members: [owner, collab] });
    (api.removeMember as Mock).mockResolvedValue({ status: "ok", members: [owner] });
  });

  afterEach(() => vi.clearAllMocks());

  it("lists existing members", async () => {
    render(<ShareDialog boardId={5} boardName="Roadmap" onClose={vi.fn()} />);
    expect(await screen.findByText("user")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });

  it("focuses the invite input when opened", () => {
    render(<ShareDialog boardId={5} boardName="Roadmap" onClose={vi.fn()} />);
    expect(screen.getByLabelText(/username to invite/i)).toHaveFocus();
  });

  it("invites a member and shows the updated list", async () => {
    render(<ShareDialog boardId={5} boardName="Roadmap" onClose={vi.fn()} />);
    await screen.findByText("user");
    await userEvent.type(screen.getByLabelText(/username to invite/i), "collab");
    await userEvent.click(screen.getByRole("button", { name: /invite/i }));

    await waitFor(() => expect(api.addMember as Mock).toHaveBeenCalledWith(5, "collab"));
    expect(await screen.findByText("collab")).toBeInTheDocument();
  });

  it("shows an error when the invite fails", async () => {
    (api.addMember as Mock).mockRejectedValue(new api.ApiError(404, "User not found"));
    render(<ShareDialog boardId={5} boardName="Roadmap" onClose={vi.fn()} />);
    await screen.findByText("user");
    await userEvent.type(screen.getByLabelText(/username to invite/i), "ghost");
    await userEvent.click(screen.getByRole("button", { name: /invite/i }));
    expect(await screen.findByText(/user not found/i)).toBeInTheDocument();
  });

  it("removes a member", async () => {
    (api.listMembers as Mock).mockResolvedValue({ members: [owner, collab] });
    render(<ShareDialog boardId={5} boardName="Roadmap" onClose={vi.fn()} />);
    await screen.findByText("collab");
    await userEvent.click(screen.getByRole("button", { name: /remove collab/i }));
    await waitFor(() => expect(api.removeMember as Mock).toHaveBeenCalledWith(5, 2));
  });
});
