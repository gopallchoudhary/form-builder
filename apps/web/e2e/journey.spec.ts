import { expect, test, type Page } from "@playwright/test";

/**
 * The whole product, in one test, with a real browser and a real database.
 *
 * Every step below is something a unit test cannot see: the session cookie being forwarded
 * from a server component, the autosave's debounce actually landing, a publish gate
 * refusing a form that is not fillable, and the respondent's response showing up in the
 * creator's table with the counts moved. The journey ends by checking the *outcome* — the
 * number in the creator's own analytics — rather than a toast.
 */

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function signUp(page: Page) {
  const email = `e2e-${unique()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Full Name").fill("E2E Creator");
  await page.getByLabel("Email").fill(email);
  // `exact`, because the form also has a `Confirm Password` field.
  await page.getByLabel("Password", { exact: true }).fill("a-very-long-password");
  await page.getByLabel("Confirm Password").fill("a-very-long-password");
  await page.getByRole("button", { name: "Create Account" }).click();

  // The dashboard layout redirects a signed-out visitor, so landing here is the proof.
  await expect(page).toHaveURL(/\/dashboard/);
  return email;
}

/** A creator with a published stepper form holding a text and a yes/no question. */
async function createPublishedForm(page: Page, title: string) {
  await page.goto("/forms");
  // `.first()`, because an account with no forms shows the trigger twice: in the header
  // and in the empty state.
  await page.getByRole("button", { name: /new form/i }).first().click();
  await page.getByLabel(/^title/i).fill(title);
  await page.getByRole("button", { name: /^create form$/i }).click();

  await page.waitForURL(/\/forms\/[0-9a-f-]{36}\/build/);
  const formId = page.url().match(/forms\/([0-9a-f-]{36})/)?.[1];
  expect(formId).toBeTruthy();

  // Two questions, through the real builder, the real inspector and the real autosave.
  // The second is yes/no so the stepper has a step to advance *to* — Enter has to go
  // somewhere, and a one-question form would submit on the first Enter.
  await page.getByRole("button", { name: /add the first question|add question/i }).first().click();
  await page.getByLabel("Question", { exact: true }).fill("Your name");
  await expect(page.getByText("Your name").first()).toBeVisible();

  await page.getByRole("button", { name: /add question/i }).first().click();
  await page.getByRole("combobox", { name: "Answer type" }).click();
  await page.getByRole("option", { name: "Yes / no" }).click();
  await page.getByLabel("Question", { exact: true }).fill("Recommend us?");
  await expect(page.getByText("Recommend us?").first()).toBeVisible();

  // The published link is what the respondent will open, so read it from the share tab
  // rather than assuming a slug.
  await page.getByRole("link", { name: "Share" }).click();
  const link = page.getByLabel("Public form link");
  await expect(link).toBeVisible();
  const shareUrl = await link.inputValue();

  /*
   * Absolute, with the origin it was configured with.
   *
   * This used to assert only that the string contained `/f/`, which a bare `/f/my-form`
   * satisfies — so the suite was green while every share link in the app was something no
   * respondent could open. The property worth protecting is that the link can be pasted into a
   * chat and work, which means a real origin, not just a path.
   */
  const parsed = new URL(shareUrl);
  expect(parsed.origin, "share link needs an origin, not a bare path").toBe(
    new URL(page.url()).origin,
  );
  expect(parsed.pathname).toMatch(/^\/f\/[a-z0-9-]+$/);

  await page.getByRole("link", { name: "Build" }).click();
  await page.getByRole("button", { name: /^publish$/i }).click();
  await expect(page.getByText("Live")).toBeVisible();

  return { formId: formId!, shareUrl };
}

test.describe("the product, end to end", () => {
  test("a creator builds, publishes and shares; a respondent completes; the creator sees it", async ({
    browser,
    page,
  }) => {
    test.slow();
    await signUp(page);

    const { formId, shareUrl } = await createPublishedForm(page, `E2E ${unique()}`);

    // A fresh context: no cookie, nothing carried over from the creator's session. This is
    // what a respondent actually is.
    const respondent = await browser.newContext();
    const form = await respondent.newPage();
    await form.goto(shareUrl);

    await expect(form.getByRole("heading", { name: /E2E/ })).toBeVisible();
    await form.getByLabel(/your name/i).fill("Priya");

    // Enter advances a stepper form without touching the mouse.
    await form.getByLabel(/your name/i).press("Enter");

    // The session is established before submit, and a draft save happens on every step.
    await expect(form.getByText(/getting this form ready/i)).toBeHidden();
    await form.getByRole("radio", { name: /^yes$/i }).first().click();
    await form.getByRole("button", { name: /submit/i }).click();

    await expect(form).toHaveURL(/\/thanks$/);
    await expect(form.getByRole("heading", { name: /thank you/i })).toBeVisible();

    // The outcome: the response is in the creator's table, and the count has moved.
    // Responses and Analytics are sections with a form picker, so the form travels in the
    // query string rather than the path.
    await page.goto(`/responses?form=${formId}`);
    await expect(page.getByRole("cell", { name: "Priya" })).toBeVisible();

    await page.goto(`/analytics?form=${formId}`);
    const kpi = page.getByRole("region", { name: "Summary" });
    await expect(kpi.getByText("Responses")).toBeVisible();

    const responses = await page
      .getByRole("region", { name: "Summary" })
      .locator("dd")
      .first()
      .innerText();
    expect(Number(responses)).toBeGreaterThanOrEqual(1);

    await respondent.close();
  });

  test("a draft survives a refresh, and the respondent finishes it once", async ({
    browser,
    page,
  }) => {
    test.slow();
    await signUp(page);
    const { shareUrl } = await createPublishedForm(page, `E2E resume ${unique()}`);

    const respondent = await browser.newContext();
    const form = await respondent.newPage();
    await form.goto(shareUrl);

    await form.getByLabel(/your name/i).fill("Halfway");

    // Wait for the draft save itself rather than guessing at a delay: reloading while
    // the request is still in flight is exactly the race this test is meant to rule out.
    const saved = form.waitForResponse((r) => /saveDraft/.test(r.url()) && r.status() === 200);
    await form.getByLabel(/your name/i).press("Enter");
    await saved;

    await form.reload();

    /*
     * A refresh puts the respondent back on the step they left, not on the first one —
     * that is the whole point of persisting the position, and it is why the answer is
     * checked from here rather than from the top.
     */
    await expect(form.getByText("2 of 2")).toBeVisible();
    await expect(form.getByText(/recommend us\?/i)).toBeVisible();

    await form.getByRole("button", { name: /back/i }).click();
    await expect(form.getByLabel(/your name/i)).toHaveValue("Halfway");

    // Forward again, then finish it.
    await form.getByLabel(/your name/i).press("Enter");
    await form.getByRole("radio", { name: /^yes$/i }).first().click();
    await form.getByRole("button", { name: /submit/i }).click();
    await expect(form).toHaveURL(/\/thanks$/);

    // Coming back to the form after submitting says so, rather than letting them do it
    // again and losing the second attempt silently.
    await form.goto(shareUrl);
    await expect(form.getByRole("heading", { name: /already responded/i })).toBeVisible();

    await respondent.close();
  });

  test("a signed-out visitor is redirected before any protected content is painted", async ({
    page,
  }) => {
    const anonymous = await page.context().browser()!.newContext();
    const stranger = await anonymous.newPage();

    await stranger.goto("/dashboard");
    await expect(stranger).toHaveURL(/\/login$/);

    // Not merely redirected: the protected shell was never sent. These are markers of the
    // console layout, so finding either in the HTML would mean the guard ran too late.
    const html = await stranger.content();
    expect(html).not.toContain("Overview");
    expect(html).not.toContain("Sign out");

    await anonymous.close();
  });

  test("a form with no questions cannot be published", async ({ page }) => {
    await signUp(page);

    await page.goto("/forms");
    await page.getByRole("button", { name: /new form/i }).first().click();
    await page.getByLabel(/^title/i).fill(`Empty ${unique()}`);
    await page.getByRole("button", { name: /^create form$/i }).click();
    await page.waitForURL(/\/forms\/[0-9a-f-]{36}\/build/);

    // The gate is a server rule, so the only honest way to see it is to try.
    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /at least one question/i }),
    ).toBeVisible();
    await expect(page.getByText("Live")).toHaveCount(0);
  });
});
