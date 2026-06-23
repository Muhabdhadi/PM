import { expect, test } from "@playwright/test";

const SEED_BOARD = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1"] },
    { id: "col-discovery", title: "Discovery", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-review", title: "Review", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Seed card", details: "" },
  },
};

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/login", {
    data: { username: "user", password: "password" },
  });
  // Reset the default board to a known state.
  await page.request.put("/api/board", { data: SEED_BOARD });
});

test("loads the workspace and board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My Board" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("filters cards by search query", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("card-card-1")).toBeVisible();

  await page.getByLabel("Search cards").fill("nonexistent term");
  await expect(page.getByTestId("card-card-1")).toHaveCount(0);
  await expect(page.getByText(/no cards match your filters/i)).toBeVisible();

  await page.getByLabel("Search cards").fill("seed");
  await expect(page.getByTestId("card-card-1")).toBeVisible();
});

test("edits a card to add a priority", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit Seed card" }).click();
  const dialog = page.getByRole("dialog", { name: /edit card/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Priority").selectOption("high");
  await dialog.getByLabel("Labels (comma separated)").fill("urgent");
  await dialog.getByLabel("Assignee").fill("dana");
  await dialog.getByRole("button", { name: /^save$/i }).click();

  const card = page.getByTestId("card-card-1");
  await expect(card.getByText("high")).toBeVisible();
  await expect(card.getByText("urgent")).toBeVisible();
  await expect(card.getByText("dana")).toBeVisible();
});

test("adds a comment to a card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Edit Seed card" }).click();
  const dialog = page.getByRole("dialog", { name: /edit card/i });
  await expect(dialog.getByText(/no comments yet/i)).toBeVisible();

  await dialog.getByLabel("Add a comment").fill("Reviewed and approved");
  await dialog.getByRole("button", { name: /^comment$/i }).click();

  await expect(dialog.getByText("Reviewed and approved")).toBeVisible();
  // The comment count badge appears on the card after closing the editor.
  await dialog.getByRole("button", { name: /^cancel$/i }).click();
  await expect(page.getByTestId("card-card-1").getByText(/💬\s*1/)).toBeVisible();
});

test("shows board activity after adding a card", async ({ page }) => {
  await page.goto("/");
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Activity card");
  // Wait for the create to persist server-side (UI add is optimistic).
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/cards") && r.request().method() === "POST"
    ),
    firstColumn.getByRole("button", { name: /add card/i }).click(),
  ]);
  await expect(firstColumn.getByText("Activity card")).toBeVisible();

  await page.getByRole("button", { name: /^activity$/i }).click();
  const dialog = page.getByRole("dialog", { name: /board activity/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/added card .*Activity card/).first()).toBeVisible();
});

test("adds and removes a column", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);

  await page.getByRole("button", { name: /add column/i }).click();
  await page.getByLabel("New column title").fill("QA");
  await page.getByLabel("New column title").press("Enter");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(6);

  await page.getByRole("button", { name: /delete qa column/i }).click();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("toggles dark mode", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const before = (await html.getAttribute("class")) ?? "";
  await page.getByRole("button", { name: /toggle dark mode/i }).click();
  const after = (await html.getAttribute("class")) ?? "";
  expect(before.includes("dark")).not.toBe(after.includes("dark"));
});

test("creates a new board and switches to it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "My Board" })).toBeVisible();

  const name = `E2E Board ${Date.now()}`;
  await page.getByRole("button", { name: /new board/i }).click();
  await page.getByLabel("New board name").fill(name);
  await page.getByLabel("New board name").press("Enter");

  // The new board becomes active and its name shows as the heading.
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Switch back to the default board.
  await page.getByText("My Board", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "My Board" })).toBeVisible();

  // Clean up the board we created so the dev DB doesn't accumulate.
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await expect(page.getByRole("button", { name })).toHaveCount(0);
});
