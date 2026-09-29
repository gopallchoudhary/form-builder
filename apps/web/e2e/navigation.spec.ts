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

/**
 * Signing out, in a browser, over the transport the app uses.
 *
 * This procedure once declared an input of `z.undefined()`, which is uncallable over tRPC:
 * `httpLink` sends no body for a void mutation, tRPC reads an absent body as `{}`, and the
 * sign-out answered 400 — the cookie stayed and the session never ended. The API tests
 * missed it because they only ever posted to the REST route, which had kept working the
 * whole time. A test that drives the real transport is the only thing that would have
 * caught it, so there is one now.
 */
test("signing out ends the session", async ({ page }) => {
  const unique = `${Date.now()}-so`;

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Sign Out Creator");
  await page.getByLabel("Email").fill(`so-${unique}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-very-long-password");
  await page.getByLabel("Confirm password").fill("a-very-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);

  await page.getByRole("button", { name: /^sign out$/i }).click();
  await page.waitForURL(/\/login$/);

  // Not just a redirect: the cookie is gone, so a protected route sends them back.
  await page.goto("/forms");
  await expect(page).toHaveURL(/\/login$/);
});

/**
 * Responses and Analytics as sections rather than form tabs.
 *
 * Two things here are easy to get wrong and invisible when broken: the sidebar link must
 * land on a real page with no form in the URL, and the picker must put the chosen form
 * somewhere durable. A picker that only changed a component's local state would look
 * identical while producing an unshareable link, so the assertion is on the URL.
 */
test("responses and analytics choose a form, and the choice is in the URL", async ({ page }) => {
  test.slow();

  const unique = `${Date.now()}-pick`;

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Picker Creator");
  await page.getByLabel("Email").fill(`pick-${unique}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-very-long-password");
  await page.getByLabel("Confirm password").fill("a-very-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);

  const makeForm = async (title: string) => {
    await page.goto("/forms");
    await page.getByRole("button", { name: /new form/i }).first().click();
    await page.getByLabel(/^title/i).fill(title);
    await page.getByRole("button", { name: /^create form$/i }).click();
    await page.waitForURL(/\/forms\/[0-9a-f-]{36}\/build/);

    const id = page.url().match(/forms\/([0-9a-f-]{36})/)?.[1];
    // A missing id here would make every later assertion pass against `undefined`, which is
    // the failure mode this whole test exists to avoid.
    expect(id, `no form id in ${page.url()}`).toBeTruthy();
    return id as string;
  };

  const older = await makeForm(`Older ${unique}`);
  const newer = await makeForm(`Newer ${unique}`);

  /*
   * First visit, nothing remembered: the section picks the newest form.
   *
   * The URL stays bare. It used to be rewritten here to `?form=<newest>`, which meant the
   * address a creator copied was a guess about them rather than something they had chosen —
   * so a "shareable link" from a bare `/responses` was only ever the newest form's.
   */
  await page.goto("/responses");
  await expect(page.getByRole("combobox", { name: "Form" })).toBeVisible();
  await expect(page).toHaveURL(/\/responses$/);
  await expect(page.getByRole("combobox", { name: "Form" })).toContainText(`Newer ${unique}`);

  // Choosing from the picker puts the choice in the URL, so the view is shareable.
  const picker = page.getByRole("combobox", { name: "Form" });
  await expect(picker).toBeVisible();
  await picker.click();
  // `Older` rather than `Newer`: the picker already shows `Newer`, so choosing it again
  // changes nothing and would pass whether or not the click reached the handler.
  await page.getByRole("option", { name: `Older ${unique}` }).click();
  // `toHaveURL` matches against the whole URL, so the pattern has to allow for the origin —
  // anchoring at `^/responses` would never match, and would fail the same way whether or not
  // the form was carried across.
  await expect(page).toHaveURL(new RegExp(`/responses\\?form=${older}$`));
  expect(page.url()).not.toContain(newer);

  // The builder's shortcut carries the form across, so the one-step path survives.
  await page.goto(`/forms/${older}/build`);
  // Waiting for the link to be there first: `page.goto` resolves on `load`, which can land
  // before the client-side chrome has rendered its header.
  await expect(page.getByRole("link", { name: "View responses" })).toBeVisible();
  await page.getByRole("link", { name: "View responses" }).click();
  await expect(page).toHaveURL(new RegExp(`/responses\\?form=${older}$`));

  await page.goto(`/forms/${older}/build`);
  await expect(page.getByRole("link", { name: "View analytics" })).toBeVisible();
  await page.getByRole("link", { name: "View analytics" }).click();
  await expect(page).toHaveURL(new RegExp(`/analytics\\?form=${older}$`));

  // And the section is reachable from the sidebar, highlighted as itself.
  await page.getByRole("link", { name: "Responses" }).click();
  await expect(page).toHaveURL(/\/responses/);
  const active = page.locator('[data-slot="sidebar-menu-button"][data-active="true"]');
  await expect(active).toHaveCount(1);
  await expect(active).toContainText("Responses");
});

/**
 * The round trip, which is the bug in one test.
 *
 * Choose a form, leave through the sidebar, come back. The sidebar links to a bare
 * `/responses`, so the `?form=` that held the choice is gone by the time you return — and
 * when the choice lived nowhere else, the section fell back to the newest form and quietly
 * showed you somebody else's work. The assertion is on which form is in the picker, not on
 * the URL, because the URL is allowed to be empty here; that is the whole point.
 */
test("the chosen form survives leaving through the sidebar and coming back", async ({ page }) => {
  test.slow();

  const unique = `${Date.now()}-memo`;

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Memory Creator");
  await page.getByLabel("Email").fill(`memo-${unique}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-very-long-password");
  await page.getByLabel("Confirm password").fill("a-very-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);

  const makeForm = async (title: string) => {
    await page.goto("/forms");
    await page.getByRole("button", { name: /new form/i }).first().click();
    await page.getByLabel(/^title/i).fill(title);
    await page.getByRole("button", { name: /^create form$/i }).click();
    await page.waitForURL(/\/forms\/[0-9a-f-]{36}\/build/);
    const id = page.url().match(/forms\/([0-9a-f-]{36})/)?.[1];
    expect(id, `no form id in ${page.url()}`).toBeTruthy();
    return id as string;
  };

  // Created in this order, so "most recently updated" and "the one I chose" disagree. That
  // disagreement is the bug: a fallback would pass while showing the wrong form.
  await makeForm(`First ${unique}`);
  const chosen = await makeForm(`Chosen ${unique}`);
  await makeForm(`Newest ${unique}`);

  await page.goto("/responses");
  await expect(page.getByRole("combobox", { name: "Form" })).toBeVisible();

  const picker = page.getByRole("combobox", { name: "Form" });
  await picker.click();
  await page.getByRole("option", { name: `Chosen ${unique}` }).click();
  await expect(picker).toContainText(`Chosen ${unique}`);

  // Leave the way a person would — through the sidebar, with no query param — and come back.
  await page.getByRole("link", { name: "Forms", exact: true }).click();
  await page.waitForURL(/\/forms$/);

  await page.getByRole("link", { name: "Responses" }).click();
  await page.waitForURL(/\/responses$/);
  await expect(
    page.getByRole("combobox", { name: "Form" }),
    "the chosen form was forgotten on navigation",
  ).toContainText(`Chosen ${unique}`);

  // And the other section agrees, because the memory is shared: you are comparing the two
  // views of one form, not two unrelated things that drifted apart.
  await page.getByRole("link", { name: "Analytics" }).click();
  await page.waitForURL(/\/analytics$/);
  await expect(page.getByRole("combobox", { name: "Form" })).toContainText(`Chosen ${unique}`);

  // A full reload, too — the memory is persisted, not just held in memory.
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Form" }),
    "the chosen form was forgotten on reload",
  ).toContainText(`Chosen ${unique}`);

  void chosen;
});

/**
 * Filters survive the same round trip.
 *
 * The row-based state is part of the same view, and a creator who has just narrowed to "in
 * progress" and typed a search does not want to do it again. Changing form is the one thing
 * that *should* clear them: page 4 of one form's rows is not page 4 of another's.
 */
test("response filters survive navigation, and reset when the form changes", async ({ page }) => {
  test.slow();

  const unique = `${Date.now()}-filt`;

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Filter Creator");
  await page.getByLabel("Email").fill(`filt-${unique}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-very-long-password");
  await page.getByLabel("Confirm password").fill("a-very-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/dashboard/);

  const makeForm = async (title: string) => {
    await page.goto("/forms");
    await page.getByRole("button", { name: /new form/i }).first().click();
    await page.getByLabel(/^title/i).fill(title);
    await page.getByRole("button", { name: /^create form$/i }).click();
    await page.waitForURL(/\/forms\/[0-9a-f-]{36}\/build/);
    return page.url().match(/forms\/([0-9a-f-]{36})/)?.[1] as string;
  };

  await makeForm(`Filt A ${unique}`);
  await makeForm(`Filt B ${unique}`);

  await page.goto("/responses");
  const picker = page.getByRole("combobox", { name: "Form" });
  await expect(picker).toBeVisible();

  // Type a search that matches nothing — the point is that the *value* persists, not the
  // results, so this cannot pass by accident on a populated table.
  await page.getByLabel("Search answers").fill("nobody-by-this-name");
  await page.getByLabel("Search answers").blur();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Responses" }).click();
  await page.waitForURL(/\/responses$/);

  await expect(
    page.getByLabel("Search answers"),
    "the search was forgotten on navigation",
  ).toHaveValue("nobody-by-this-name");

  // Changing form clears it: the same search against different rows is a different question.
  await picker.click();
  await page.getByRole("option", { name: `Filt A ${unique}` }).click();
  await expect(page.getByLabel("Search answers")).toHaveValue("");
});
