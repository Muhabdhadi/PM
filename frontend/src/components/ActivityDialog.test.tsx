import { render, screen } from "@testing-library/react";
import { vi, type Mock } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, listActivity: vi.fn() };
});

import { ActivityDialog } from "@/components/ActivityDialog";
import * as api from "@/lib/api";

describe("ActivityDialog", () => {
  afterEach(() => vi.clearAllMocks());

  it("renders activity entries", async () => {
    (api.listActivity as Mock).mockResolvedValue({
      activity: [
        { actor: "user", action: "added card “Spec”", created_at: "2026-01-01T00:00:00Z" },
        { actor: "collab", action: "commented on “Spec”", created_at: "2026-01-02T00:00:00Z" },
      ],
    });
    render(<ActivityDialog boardId={1} onClose={vi.fn()} />);
    expect(await screen.findByText(/added card/)).toBeInTheDocument();
    expect(screen.getByText(/commented on/)).toBeInTheDocument();
    expect(screen.getByText("collab")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    (api.listActivity as Mock).mockResolvedValue({ activity: [] });
    render(<ActivityDialog boardId={1} onClose={vi.fn()} />);
    expect(await screen.findByText(/no activity yet/i)).toBeInTheDocument();
  });
});
