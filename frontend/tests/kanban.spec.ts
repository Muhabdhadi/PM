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
});
