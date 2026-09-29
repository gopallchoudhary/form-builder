import { expect, test } from "@playwright/test";

/**
 * The sidebar footer, in both widths.
 *
 * Sign-out used to be a plain button, so the collapsed sidebar kept the word "Sign out" in a
 * 32px rail — the label was clipped to a stub beside the icon, or spilled over the edge. It is
 * a `SidebarMenuButton` now, which collapses the way the navigation above it does and carries
 * a tooltip in place of the text.
 *
 * The measurement is the assertion: a collapsed button is 32px wide, an expanded one fills the
 * rail. Checking the text is not enough, because the text stays in the DOM either way — it is
 * hidden with the `size-8!` rule, not removed.
 */
test("the footer collapses to icon-only, and still says what it does", async ({ page }) => {
  const unique = `${Date.now()}-foot`;

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Footer Creator");
  await page.getByLabel("Email").fill(`foot-${unique}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-very-long-password");
  await page.getByLabel("Confirm password").fill("a-very-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);

  const signOut = page.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeVisible();

  const expanded = await signOut.boundingBox();
  expect(expanded?.width, "expanded sign-out should fill the rail").toBeGreaterThan(100);

  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  await page.waitForTimeout(500);

  const collapsed = await signOut.boundingBox();
  // `size-8`: icon only, no room for a word.
  expect(collapsed?.width, "collapsed sign-out should be an icon").toBeLessThanOrEqual(40);

  // And it is still named, so a screen reader announces it and the tooltip can carry the
  // label the collapsed width has no room for.
  await expect(signOut).toHaveAccessibleName(/sign out/i);
});
