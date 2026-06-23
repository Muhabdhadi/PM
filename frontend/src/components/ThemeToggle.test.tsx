import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/ThemeToggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    localStorage.clear();
  });

  it("toggles the dark class and persists the choice", async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: /toggle dark mode/i });

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await userEvent.click(btn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(btn).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(btn);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("reflects an already-dark document on mount", () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /toggle dark mode/i })).toHaveTextContent(/light/i);
  });
});
