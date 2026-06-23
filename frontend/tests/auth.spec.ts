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

test("a user can change their password and re-login", async ({ page }) => {
  const username = `pw_${Date.now()}`;
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("heading", { name: "My Board" })).toBeVisible();

  // Open account settings from the sidebar username button.
  await page.getByRole("button", { name: "Account settings" }).click();
  const dialog = page.getByRole("dialog", { name: /account settings/i });
  await dialog.getByLabel(/current password/i).fill("password123");
  await dialog.getByLabel("New password", { exact: true }).fill("newpass456");
  await dialog.getByLabel(/confirm new password/i).fill("newpass456");
  await dialog.getByRole("button", { name: /update password/i }).click();
  await expect(dialog.getByText(/password updated/i)).toBeVisible();
  await dialog.getByRole("button", { name: /close/i }).click();

  // Sign out and log back in with the new password.
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("newpass456");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("heading", { name: "My Board" })).toBeVisible();
});

test("redirects unauthenticated users to login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});
