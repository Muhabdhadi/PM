import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, changePassword: vi.fn() };
});

import { AccountDialog } from "@/components/AccountDialog";
import * as api from "@/lib/api";

describe("AccountDialog", () => {
  afterEach(() => vi.clearAllMocks());

  it("changes the password and shows confirmation", async () => {
    (api.changePassword as Mock).mockResolvedValue({ status: "ok" });
    render(<AccountDialog username="user" onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/current password/i), "oldpass1");
    await userEvent.type(screen.getByLabelText("New password"), "newpass123");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() =>
      expect(api.changePassword as Mock).toHaveBeenCalledWith("oldpass1", "newpass123")
    );
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });

  it("rejects mismatched new passwords without calling the API", async () => {
    render(<AccountDialog username="user" onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/current password/i), "oldpass1");
    await userEvent.type(screen.getByLabelText("New password"), "newpass123");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "different");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));

    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(api.changePassword as Mock).not.toHaveBeenCalled();
  });

  it("surfaces API errors", async () => {
    (api.changePassword as Mock).mockRejectedValue(new api.ApiError(400, "Current password is incorrect"));
    render(<AccountDialog username="user" onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/current password/i), "wrong");
    await userEvent.type(screen.getByLabelText("New password"), "newpass123");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument();
  });
});
