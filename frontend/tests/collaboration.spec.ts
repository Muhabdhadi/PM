import { expect, test, request as playwrightRequest } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/login", {
    data: { username: "user", password: "password" },
  });
});

test("owner can share a board and revoke access", async ({ page }) => {
  // Register an isolated collaborator without disturbing the page session.
  const collab = `collab_${Date.now()}`;
  const ctx = await playwrightRequest.newContext({ baseURL: "http://127.0.0.1:8000" });
  const reg = await ctx.post("/api/register", {
    data: { username: collab, password: "password123" },
  });
  expect(reg.ok()).toBeTruthy();
  await ctx.dispose();

  await page.goto("/");
  await page.getByRole("button", { name: "Share My Board" }).click();

  const dialog = page.getByRole("dialog", { name: /share board/i });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Username to invite").fill(collab);
  await dialog.getByRole("button", { name: /invite/i }).click();
  await expect(dialog.getByText(collab)).toBeVisible();

  // Revoke to keep the dev DB tidy.
  await dialog.getByRole("button", { name: `Remove ${collab}` }).click();
  await expect(dialog.getByText(collab)).toHaveCount(0);
});
