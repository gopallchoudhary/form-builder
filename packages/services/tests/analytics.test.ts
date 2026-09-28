import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import AccessService from "../access";
import AnalyticsService from "../analytics";
import ResponseService from "../response";
import { createServiceHarness, createUser, servicesAvailable, type ServiceHarness } from "./harness";

/**
 * Responses and analytics read from the raw stored values, so these assert the numbers
 * against what was actually submitted — the queries are the part most likely to be
 * silently wrong.
 */
describe.skipIf(!servicesAvailable)("responses and analytics", () => {
  let harness: ServiceHarness;
  let access: AccessService;
  let responses: ResponseService;
  let analytics: AnalyticsService;
  let owner: { id: string; email: string };

  beforeAll(async () => {
    harness = await createServiceHarness("analytics");
    access = new AccessService(harness.db);
    responses = new ResponseService(harness.db);
    analytics = new AnalyticsService(harness.db);
  });

  afterAll(async () => {
    await harness?.close();
  });

  beforeEach(async () => {
    await harness.reset();
    owner = await createUser(harness);
  });

  const device = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

  interface Seeded {
    slug: string;
    formId: string;
    nameId: string;
    ratingId: string;
  }

  /** A published form with a text and a rating question. */
  async function seedForm(): Promise<Seeded> {
    const { id: formId, slug } = await harness.forms.createForm(owner.id, { title: "Survey" });
    const { id: nameId } = await harness.questions.createQuestion(owner.id, {
      formId,
      kind: "SHORT_TEXT",
      label: "Name",
    });
    const { id: ratingId } = await harness.questions.createQuestion(owner.id, {
      formId,
      kind: "RATING",
      label: "How were we?",
      settings: { scale: 5, style: "STAR" },
    });
    await harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" });
    return { slug, formId, nameId, ratingId };
  }

  async function submit(form: Seeded, deviceNumber: number, name: string, rating: number) {
    const session = await access.startSession({ slug: form.slug, deviceId: device(deviceNumber) });
    const result = await access.submit({
      sessionId: session.sessionId,
      deviceId: device(deviceNumber),
      answers: [
        { questionId: form.nameId, value: name },
        { questionId: form.ratingId, value: rating },
      ],
    });
    expect(result.status).toBe("SUBMITTED");
  }

  describe("responses", () => {
    it("lists completed responses with their answers and duration", async () => {
      const form = await seedForm();
      await submit(form, 1, "Gopal", 5);
      await submit(form, 2, "Priya", 3);

      const page = await responses.listResponses(owner.id, { formId: form.formId });

      expect(page.total).toBe(2);
      expect(page.responses).toHaveLength(2);

      for (const response of page.responses) {
        expect(response.status).toBe("COMPLETED");
        expect(response.durationSeconds).not.toBeNull();
        expect(response.answers).toHaveLength(2);
      }

      // Both respondents are present, whichever order they come back in.
      const names = page.responses
        .flatMap((response) => response.answers.map((answer) => answer.valueText))
        .filter(Boolean);
      expect(names).toEqual(expect.arrayContaining(["Gopal", "Priya"]));

      // Numbers render the way a person writes them, not as 5.000000.
      const ratings = page.responses.flatMap((response) =>
        response.answers.map((answer) => answer.valueNumber),
      );
      expect(ratings).toEqual(expect.arrayContaining(["5", "3"]));
    });

    it("excludes drafts from the default list but can include them", async () => {
      const form = await seedForm();
      await submit(form, 1, "Gopal", 4);

      const draft = await access.startSession({ slug: form.slug, deviceId: device(2) });
      await access.saveDraft({
        sessionId: draft.sessionId,
        deviceId: device(2),
        answers: [{ questionId: form.nameId, value: "Half done" }],
      });

      const completed = await responses.listResponses(owner.id, { formId: form.formId });
      expect(completed.total).toBe(1);

      const all = await responses.listResponses(owner.id, {
        formId: form.formId,
        status: "ALL",
      });
      expect(all.total).toBe(2);
    });

    it("searches inside answers", async () => {
      const form = await seedForm();
      await submit(form, 1, "Gopal", 5);
      await submit(form, 2, "Priya", 3);

      const found = await responses.listResponses(owner.id, {
        formId: form.formId,
        search: "pri",
      });

      expect(found.total).toBe(1);
      expect(found.responses[0]!.answers.map((answer) => answer.valueText)).toContain("Priya");
    });

    it("hides another user's responses", async () => {
      const form = await seedForm();
      await submit(form, 1, "Gopal", 5);

      const stranger = await createUser(harness);
      await expect(
        responses.listResponses(stranger.id, { formId: form.formId }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
    });

    it("exports CSV with one column per question and correct escaping", async () => {
      const form = await seedForm();
      await submit(form, 1, 'Gopal, Jr "the builder"', 5);

      const csv = await responses.exportCsv(owner.id, { formId: form.formId });
      const [header, row] = csv.split("\r\n");

      expect(header).toContain("Name");
      expect(header).toContain("How were we?");
      // A comma and a quote must be quoted and doubled, or the column count breaks.
      expect(row).toContain('"Gopal, Jr ""the builder"""');
    });

    it("neutralises a value that a spreadsheet would read as a formula", async () => {
      const form = await seedForm();
      await submit(form, 1, "=1+1", 5);

      const csv = await responses.exportCsv(owner.id, { formId: form.formId });
      expect(csv).toContain("'=1+1");
    });
  });

  describe("analytics", () => {
    it("counts views, starts and completions into a funnel", async () => {
      const form = await seedForm();

      // One respondent completes.
      await submit(form, 1, "Gopal", 5);
      // One opens the form and abandons it.
      await access.startSession({ slug: form.slug, deviceId: device(2) });
      // One only looks.
      await access.getPublicFormBySlug({ slug: form.slug });

      const funnel = await analytics.getFunnel(owner.id, { formId: form.formId });

      expect(funnel.completions).toBe(1);
      expect(funnel.starts).toBe(2);
      expect(funnel.views).toBeGreaterThanOrEqual(2);
      expect(funnel.overallRate).toBeGreaterThan(0);
      expect(funnel.overallRate).toBeLessThanOrEqual(1);
    });

    it("reports an empty form without dividing by zero", async () => {
      const form = await seedForm();
      const funnel = await analytics.getFunnel(owner.id, { formId: form.formId });

      expect(funnel.views).toBe(0);
      expect(funnel.completions).toBe(0);
      expect(funnel.overallRate).toBe(0);
    });

    it("groups a time series by day with a view and a submission per bucket", async () => {
      const form = await seedForm();
      await submit(form, 1, "Gopal", 5);

      const report = await analytics.getFormAnalytics(owner.id, { formId: form.formId });

      expect(report.granularity).toBe("day");
      expect(report.series.length).toBeGreaterThan(0);
      const today = report.series.find((point) => point.at.startsWith(new Date().toISOString().slice(0, 10)));
      expect(today?.submissions).toBe(1);
      expect(report.questionCount).toBe(2);
    });

    it("counts answers per option for a choice question", async () => {
      const { id: formId } = await harness.forms.createForm(owner.id, { title: "Choice" });
      const { id: questionId } = await harness.questions.createQuestion(owner.id, {
        formId,
        kind: "SINGLE_CHOICE",
        label: "Plan",
        settings: {
          options: [
            { id: "free", label: "Free" },
            { id: "pro", label: "Pro" },
          ],
        },
      });
      await harness.forms.setStatus(owner.id, { formId, status: "PUBLISHED" });

      const form = await harness.forms.getFormById(owner.id, formId);
      const plans = ["free", "free", "pro"];
      for (const [index, plan] of plans.entries()) {
        const id = device(20 + index);
        const session = await access.startSession({ slug: form.slug, deviceId: id });
        await access.submit({
          sessionId: session.sessionId,
          deviceId: id,
          answers: [{ questionId, value: plan }],
        });
      }

      const distribution = await analytics.getAnswerDistribution(owner.id, { formId, questionId });

      expect(distribution.total).toBe(3);
      expect(distribution.buckets).toEqual(
        expect.arrayContaining([
          { value: "free", label: "Free", count: 2 },
          { value: "pro", label: "Pro", count: 1 },
        ]),
      );
      // Biggest bucket first, which is the order the chart wants.
      expect(distribution.buckets[0]!.count).toBe(2);
    });

    it("breaks a rating question down by score", async () => {
      const form = await seedForm();
      await submit(form, 1, "Gopal", 5);
      await submit(form, 2, "Priya", 5);
      await submit(form, 3, "Amit", 1);

      const distribution = await analytics.getAnswerDistribution(owner.id, {
        formId: form.formId,
        questionId: form.ratingId,
      });

      expect(distribution.total).toBe(3);
      expect(distribution.buckets).toEqual(
        expect.arrayContaining([{ value: "5", label: "5", count: 2 }]),
      );
    });

    it("measures how long responses take", async () => {
      const form = await seedForm();
      const session = await access.startSession({ slug: form.slug, deviceId: device(30) });
      // Backdate the start so there is a measurable duration.
      await harness.raw(
        `UPDATE form_sessions SET started_at = started_at - interval '90 seconds'
         WHERE id = '${session.sessionId}'`,
      );
      await access.submit({
        sessionId: session.sessionId,
        deviceId: device(30),
        answers: [
          { questionId: form.nameId, value: "Gopal" },
          { questionId: form.ratingId, value: 4 },
        ],
      });

      const timing = await analytics.getTimeToComplete(owner.id, { formId: form.formId });

      expect(timing.count).toBe(1);
      expect(timing.averageSeconds).toBeGreaterThanOrEqual(85);
      expect(timing.averageSeconds).toBeLessThanOrEqual(100);
      expect(timing.medianSeconds).toBeGreaterThan(0);
      expect(timing.histogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(1);
    });

    it("summarises every form the user created", async () => {
      const first = await seedForm();
      await submit(first, 1, "Gopal", 5);

      const second = await harness.forms.createForm(owner.id, { title: "Second" });
      await harness.questions.createQuestion(owner.id, {
        formId: second.id,
        kind: "SHORT_TEXT",
        label: "Anything",
      });
      await harness.forms.setStatus(owner.id, { formId: second.id, status: "PUBLISHED" });

      const overview = await analytics.getOverview(owner.id, {});

      expect(overview.totals.forms).toBe(2);
      expect(overview.totals.published).toBe(2);
      expect(overview.totals.completions).toBe(1);
      expect(overview.forms).toHaveLength(2);
      // Ordered by responses, so the busier form is first.
      expect(overview.forms[0]!.id).toBe(first.formId);
    });

    it("never includes another user's forms in the overview", async () => {
      await seedForm();
      const stranger = await createUser(harness);
      const strangerForm = await harness.forms.createForm(stranger.id, { title: "Theirs" });
      await harness.questions.createQuestion(stranger.id, {
        formId: strangerForm.id,
        kind: "SHORT_TEXT",
        label: "Theirs",
      });
      await harness.forms.setStatus(stranger.id, {
        formId: strangerForm.id,
        status: "PUBLISHED",
      });

      const overview = await analytics.getOverview(owner.id, {});

      expect(overview.totals.forms).toBe(1);
      expect(overview.forms.map((form) => form.id)).not.toContain(strangerForm.id);
    });

    it("refuses analytics for a form the caller does not own", async () => {
      const form = await seedForm();
      const stranger = await createUser(harness);

      await expect(
        analytics.getFormAnalytics(stranger.id, { formId: form.formId }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(
        analytics.getQuestionDropOff(stranger.id, { formId: form.formId }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
      await expect(
        analytics.getAnswerDistribution(stranger.id, {
          formId: form.formId,
          questionId: form.nameId,
        }),
      ).rejects.toMatchObject({ kind: "FORBIDDEN" });
    });
  });
});
