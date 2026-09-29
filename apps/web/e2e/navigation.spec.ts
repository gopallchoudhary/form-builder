import { expect, test } from "@playwright/test";

/**
 * Where the console says you are.
 *
 * The sidebar used to light every item on every page, because `/dashboard` was a prefix of
 * `/dashboard/forms` and a prefix is a match. A navigation highlight that is always on is
 * not a highlight, so the rule is asserted here as well as unit-tested: exactly one item
 * carries `data-active`, and it is the one whose section you are in.
 */
test("the sidebar highlights the section you are in, and only that one", async ({ page }) => {
  const unique = `${Date.now()}-d`;
  const active = page.locator('[data-slot="sidebar-menu-button"][data-active="true"]');

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Dash Creator");
  await page.getByLabel("Email").fill(`dash-${unique}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-very-long-password");
  await page.getByLabel("Confirm password").fill("a-very-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  // The empty state is still the on-ramp, and it must point at the forms section.
  await expect(page.getByText("No forms yet")).toBeVisible();
  const cta = page.getByRole("link", { name: "Go to forms" });
  await expect(cta).toBeVisible();
  await cta.click();
  await page.waitForURL(/\/forms$/);

  await page.goto("/dashboard");
  await expect(active).toHaveCount(1);
  await expect(active).toContainText("Dashboard");

  await page.goto("/forms");
  await expect(active).toHaveCount(1);
  await expect(active).toContainText("Forms");

  // Nested inside a form, Forms stays lit — the section is still the one you are in.
  await page.getByRole("button", { name: /new form/i }).first().click();
  await page.getByLabel(/^title/i).fill(`Dash ${unique}`);
  await page.getByRole("button", { name: /^create form$/i }).click();
  await page.waitForURL(/\/forms\/[0-9a-f-]{36}\/build/);
  await expect(active).toHaveCount(1);
  await expect(active).toContainText("Forms");
});
