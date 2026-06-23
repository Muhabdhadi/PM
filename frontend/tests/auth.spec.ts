import { expect, test } from "@playwright/test";

test("registers a new account and lands in the workspace", async ({ page }) => {
  const username = `e2e_${Date.now()}`;
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page.getByRole("heading", { name: "My Board" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("rejects mismatched passwords client-side", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Username").fill("whoever");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("different123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/passwords do not match/i)).toBeVisible();
});

test("redirects unauthenticated users to login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});
