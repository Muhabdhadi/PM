import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { FilterBar } from "@/components/FilterBar";
import { emptyFilter } from "@/lib/kanban";

describe("FilterBar", () => {
  it("emits query changes", async () => {
    const onChange = vi.fn();
    render(<FilterBar filter={emptyFilter} labels={[]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Search cards"), "x");
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilter, query: "x" });
  });

  it("emits priority changes", async () => {
    const onChange = vi.fn();
    render(<FilterBar filter={emptyFilter} labels={[]} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/filter by priority/i), "high");
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilter, priority: "high" });
  });

  it("renders a label filter only when labels exist", () => {
    const { rerender } = render(
      <FilterBar filter={emptyFilter} labels={[]} onChange={vi.fn()} />
    );
    expect(screen.queryByLabelText(/filter by label/i)).not.toBeInTheDocument();
    rerender(<FilterBar filter={emptyFilter} labels={["urgent"]} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/filter by label/i)).toBeInTheDocument();
  });

  it("renders an assignee filter only when assignees exist and emits changes", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterBar filter={emptyFilter} labels={[]} onChange={onChange} />
    );
    expect(screen.queryByLabelText(/filter by assignee/i)).not.toBeInTheDocument();

    rerender(
      <FilterBar filter={emptyFilter} labels={[]} assignees={["dana"]} onChange={onChange} />
    );
    await userEvent.selectOptions(screen.getByLabelText(/filter by assignee/i), "dana");
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilter, assignee: "dana" });
  });

  it("clears an active filter", async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filter={{ query: "ship", priority: "", label: "", assignee: "" }}
        labels={[]}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(emptyFilter);
  });
});
