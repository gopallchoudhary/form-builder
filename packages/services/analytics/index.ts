import {
  and,
  asc,
  count,
  db as defaultDb,
  desc,
  eq,
  inArray,
  isNull,
  type Database,
  sql,
  type SQL,
  type SQLWrapper,
} from "@repo/database";
import { formAnswersTable } from "@repo/database/models/form-answer";
import { formEventsTable } from "@repo/database/models/form-event";
import { formSessionsTable } from "@repo/database/models/form-session";
import { formsTable } from "@repo/database/models/form";
import { questionsTable } from "@repo/database/models/question";

import { formatNumericAnswer } from "../utils/answer-validation";
import { assertFormOwnership } from "../utils/ownership";
import {
  answerDistributionInput,
  type AnswerDistributionInputType,
  formAnalyticsInput,
  type FormAnalyticsInputType,
  overviewInput,
  type OverviewInputType,
} from "./model";

/** Granularity of the time series. `AUTO` picks one from the range length. */
type Bucket = "day" | "week" | "month";

class AnalyticsService {
  constructor(private readonly db: Database = defaultDb) {}

  /**
   * Headline numbers for one form, plus the funnel and the daily trend.
   *
   * Views and starts only exist because the renderer recorded them, so the funnel is
   * read from `form_events` rather than derived from responses — otherwise a form that
   * lots of people abandoned early would look like a form nobody opened.
   */
  public async getFormAnalytics(userId: string, payload: FormAnalyticsInputType) {
    const { formId, from, to } = await formAnalyticsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);

    const range = this.dateRange(from, to);
    const bucket = chooseBucket(range);

    const [totals, byDay, funnel, questionIds] = await Promise.all([
      this.headline(formId, range),
      this.timeSeries(formId, range, bucket),
      this.funnel(formId, range),
      this.db
        .select({ id: questionsTable.id })
        .from(questionsTable)
        .where(and(eq(questionsTable.formId, formId), isNull(questionsTable.deletedAt)))
        .orderBy(asc(questionsTable.position)),
    ]);

    return {
      totals,
      granularity: bucket,
      series: byDay,
      funnel,
      questionCount: questionIds.length,
    };
  }

  public async getOverview(userId: string, payload: OverviewInputType) {
    const { from, to } = await overviewInput.parseAsync(payload);

    const range = this.dateRange(from, to);
    const bucket = chooseBucket(range);

    const forms = await this.db
      .select({
        id: formsTable.id,
        slug: formsTable.slug,
        title: formsTable.title,
        status: formsTable.status,
        createdAt: formsTable.createdAt,
      })
      .from(formsTable)
      .where(eq(formsTable.createdBy, userId))
      .orderBy(desc(formsTable.createdAt));

    const formIds = forms.map((form) => form.id);
    const empty = { views: 0, starts: 0, completions: 0 };

    const perForm =
      formIds.length === 0
        ? []
        : await this.db
            .select({ formId: formSessionsTable.formId, completions: count() })
            .from(formSessionsTable)
            .where(
              and(
                inArray(formSessionsTable.formId, formIds),
                eq(formSessionsTable.status, "COMPLETED"),
                this.inRange(sql`${formSessionsTable.completedAt}`, range),
              ),
            )
            .groupBy(formSessionsTable.formId);

    const perFormViews =
      formIds.length === 0
        ? []
        : await this.db
            .select({ formId: formEventsTable.formId, views: count() })
            .from(formEventsTable)
            .where(
              and(
                inArray(formEventsTable.formId, formIds),
                eq(formEventsTable.type, "VIEW"),
                this.inRange(sql`${formEventsTable.createdAt}`, range),
              ),
            )
            .groupBy(formEventsTable.formId);

    const completionsByForm = new Map(perForm.map((row) => [row.formId, row.completions]));
    const viewsByForm = new Map(perFormViews.map((row) => [row.formId, row.views]));

    const totals = formIds.reduce(
      (accumulator, formId) => ({
        views: accumulator.views + (viewsByForm.get(formId) ?? empty.views),
        starts: accumulator.starts,
        completions: accumulator.completions + (completionsByForm.get(formId) ?? 0),
      }),
      empty,
    );

    return {
      totals: {
        forms: forms.length,
        published: forms.filter((form) => form.status === "PUBLISHED").length,
        views: totals.views,
        completions: totals.completions,
        completionRate: rate(totals.completions, totals.views),
      },
      granularity: bucket,
      series: formIds.length === 0 ? [] : await this.timeSeriesAcrossForms(formIds, range, bucket),
      forms: forms
        .map((form) => ({
          ...form,
          views: viewsByForm.get(form.id) ?? 0,
          completions: completionsByForm.get(form.id) ?? 0,
        }))
        .sort((a, b) => b.completions - a.completions),
    };
  }

  /** views → starts → completions, with the drop-off between each stage. */
  public async getFunnel(userId: string, payload: FormAnalyticsInputType) {
    const { formId, from, to } = await formAnalyticsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);

    return this.funnel(formId, this.dateRange(from, to));
  }

  /**
   * How far respondents got, question by question.
   *
   * "Reached" counts the sessions that saw the question; "answered" counts the
   * submissions that carry an answer for it. The gap is where people fell out.
   */
  public async getQuestionDropOff(userId: string, payload: FormAnalyticsInputType) {
    const { formId, from, to } = await formAnalyticsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);
    const range = this.dateRange(from, to);

    const questions = await this.db
      .select({
        id: questionsTable.id,
        label: questionsTable.label,
        position: questionsTable.position,
        kind: questionsTable.kind,
      })
      .from(questionsTable)
      .where(and(eq(questionsTable.formId, formId), isNull(questionsTable.deletedAt)))
      .orderBy(asc(questionsTable.position));

    if (questions.length === 0) return [];

    const questionIds = questions.map((question) => question.id);

    // Sessions that completed, in this range — the population being analysed.
    const completed = await this.db
      .select({ sessionId: formSessionsTable.id })
      .from(formSessionsTable)
      .where(
        and(
          eq(formSessionsTable.formId, formId),
          eq(formSessionsTable.status, "COMPLETED"),
          this.inRange(sql`${formSessionsTable.completedAt}`, range),
        ),
      );
    const sessionIds = completed.map((row) => row.sessionId);

    const reached = new Map<string, number>();
    const answered = new Map<string, number>();

    if (sessionIds.length > 0) {
      const views = await this.db
        .select({ questionId: formEventsTable.questionId, n: count() })
        .from(formEventsTable)
        .where(
          and(
            eq(formEventsTable.formId, formId),
            eq(formEventsTable.type, "QUESTION_VIEW"),
            inArray(formEventsTable.sessionId, sessionIds),
            inArray(formEventsTable.questionId, questionIds),
          ),
        )
        .groupBy(formEventsTable.questionId);

      for (const row of views) {
        if (row.questionId) reached.set(row.questionId, row.n);
      }

      const answers = await this.db
        .select({ questionId: formAnswersTable.questionId, n: count() })
        .from(formAnswersTable)
        .where(
          and(
            inArray(formAnswersTable.sessionId, sessionIds),
            inArray(formAnswersTable.questionId, questionIds),
            eq(formAnswersTable.isDraft, false),
          ),
        )
        .groupBy(formAnswersTable.questionId);

      for (const row of answers) answered.set(row.questionId, row.n);
    }

    return questions.map((question) => {
      const reachedCount = reached.get(question.id) ?? 0;
      const answeredCount = answered.get(question.id) ?? 0;
      return {
        questionId: question.id,
        label: question.label,
        kind: question.kind,
        position: Number(question.position),
        reached: reachedCount,
        answered: answeredCount,
        // Optional questions are legitimately unanswered, so this is answered out of
        // reached rather than out of the whole funnel.
        answerRate: rate(answeredCount, reachedCount),
      };
    });
  }

  /** How people answered one question, bucketed by value. */
  public async getAnswerDistribution(
    userId: string,
    payload: AnswerDistributionInputType,
  ): Promise<{ questionId: string; total: number; buckets: { value: string; label: string; count: number }[] }> {
    const { formId, questionId } = await answerDistributionInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);

    const question = await this.db
      .select({
        kind: questionsTable.kind,
        settings: questionsTable.settings,
      })
      .from(questionsTable)
      .where(
        and(
          eq(questionsTable.id, questionId),
          eq(questionsTable.formId, formId),
          isNull(questionsTable.deletedAt),
        ),
      )
      .limit(1);

    const current = question[0];
    if (!current) return { questionId, total: 0, buckets: [] };

    const rows = await this.db
      .select({
        valueText: formAnswersTable.valueText,
        valueNumber: formAnswersTable.valueNumber,
        valueJson: formAnswersTable.valueJson,
        n: count(),
      })
      .from(formAnswersTable)
      .where(
        and(
          eq(formAnswersTable.formId, formId),
          eq(formAnswersTable.questionId, questionId),
          eq(formAnswersTable.isDraft, false),
        ),
      )
      .groupBy(formAnswersTable.valueText, formAnswersTable.valueNumber, formAnswersTable.valueJson);

    const optionLabels = new Map<string, string>();
    const settings = current.settings as { options?: { id: string; label: string }[] } | null;
    for (const option of settings?.options ?? []) {
      optionLabels.set(option.id, option.label);
    }

    const buckets = rows
      .map((row) => {
        const raw =
          row.valueText ?? formatNumericAnswer(row.valueNumber) ?? flattenJson(row.valueJson);
        const value = raw ?? "No answer";
        return {
          value,
          label: optionLabels.get(value) ?? humanise(value, current.kind),
          count: row.n,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      questionId,
      total: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
      buckets,
    };
  }

  /** How long responses take, as a histogram plus average and median. */
  public async getTimeToComplete(userId: string, payload: FormAnalyticsInputType) {
    const { formId, from, to } = await formAnalyticsInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);
    const range = this.dateRange(from, to);

    const rows = await this.db
      .select({ completedAt: formSessionsTable.completedAt, startedAt: formSessionsTable.startedAt })
      .from(formSessionsTable)
      .where(
        and(
          eq(formSessionsTable.formId, formId),
          eq(formSessionsTable.status, "COMPLETED"),
          this.inRange(sql`${formSessionsTable.completedAt}`, range),
        ),
      );

    const durations = rows
      .map((row) =>
        row.completedAt
          ? Math.max(0, Math.round((row.completedAt.getTime() - row.startedAt.getTime()) / 1000))
          : null,
      )
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);

    if (durations.length === 0) {
      return { count: 0, averageSeconds: null, medianSeconds: null, histogram: [] };
    }

    return {
      count: durations.length,
      averageSeconds: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
      medianSeconds: median(durations),
      histogram: histogram(durations),
    };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private dateRange(from?: string, to?: string) {
    return {
      from: from ? new Date(from) : null,
      to: to ? new Date(to) : null,
    };
  }

  /**
   * An optional date window over any timestamp column. Null means "unbounded", so a
   * caller that omits a bound gets the whole history.
   */
  private inRange(column: SQL, range: { from: Date | null; to: Date | null }): SQL | undefined {
    const filters: SQL[] = [];
    if (range.from) filters.push(sql`${column} >= ${range.from}`);
    if (range.to) filters.push(sql`${column} <= ${range.to}`);
    if (filters.length === 0) return undefined;
    if (filters.length === 1) return filters[0]!;
    return sql`${and(...filters)}`;
  }

  private async headline(formId: string, range: { from: Date | null; to: Date | null }) {
    const [sessions, views, starts] = await Promise.all([
      this.db
        .select({ n: count() })
        .from(formSessionsTable)
        .where(
          and(
            eq(formSessionsTable.formId, formId),
            eq(formSessionsTable.status, "COMPLETED"),
            this.inRange(sql`${formSessionsTable.completedAt}`, range),
          ),
        ),
      this.db
        .select({ n: count() })
        .from(formEventsTable)
        .where(
          and(
            eq(formEventsTable.formId, formId),
            eq(formEventsTable.type, "VIEW"),
            this.inRange(sql`${formEventsTable.createdAt}`, range),
          ),
        ),
      this.db
        .select({ n: count() })
        .from(formSessionsTable)
        .where(
          and(
            eq(formSessionsTable.formId, formId),
            this.inRange(sql`${formSessionsTable.startedAt}`, range),
          ),
        ),
    ]);

    const completions = sessions[0]?.n ?? 0;
    const viewCount = views[0]?.n ?? 0;
    const startCount = starts[0]?.n ?? 0;

    return {
      views: viewCount,
      starts: startCount,
      completions,
      completionRate: rate(completions, viewCount),
    };
  }

  private async funnel(formId: string, range: { from: Date | null; to: Date | null }) {
    const totals = await this.headline(formId, range);

    return {
      views: totals.views,
      starts: totals.starts,
      completions: totals.completions,
      viewToStartRate: rate(totals.starts, totals.views),
      startToCompleteRate: rate(totals.completions, totals.starts),
      overallRate: totals.completionRate,
    };
  }

  private async timeSeries(formId: string, range: { from: Date | null; to: Date | null }, bucket: Bucket) {
    return this.timeSeriesAcrossForms([formId], range, bucket);
  }

  private async timeSeriesAcrossForms(
    formIds: string[],
    range: { from: Date | null; to: Date | null },
    bucket: Bucket,
  ) {
    const bounded: SQL[] = [];
    if (range.from) bounded.push(sql`${formEventsTable.createdAt} >= ${range.from}`);
    if (range.to) bounded.push(sql`${formEventsTable.createdAt} <= ${range.to}`);

    const boundedSessions: SQL[] = [];
    if (range.from) boundedSessions.push(sql`${formSessionsTable.completedAt} >= ${range.from}`);
    if (range.to) boundedSessions.push(sql`${formSessionsTable.completedAt} <= ${range.to}`);

    // `date_trunc` is overloaded on its first argument, and Postgres cannot pick an
    // overload from a *bound* parameter — `date_trunc($1, …)` fails to resolve. The
    // granularity is one of three values chosen in code, never user input, so it is
    // inlined as a literal by this switch.
    const eventBucket = bucketExpression(bucket, formEventsTable.createdAt);
    const sessionBucket = bucketExpression(bucket, formSessionsTable.completedAt);

    // The event type is needed to split the counts, so it is grouped on as well. The
    // form list goes through `inArray` rather than raw SQL, because binding a JS array
    // into `= ANY($1)` does not survive the trip as a Postgres array.
    const events = await this.db
      .select({ at: eventBucket, type: sql<string>`${formEventsTable.type}::text`, n: count() })
      .from(formEventsTable)
      .where(
        and(
          inArray(formEventsTable.formId, formIds),
          inArray(formEventsTable.type, ["VIEW", "START", "SUBMIT"]),
          ...bounded,
        ),
      )
      .groupBy(eventBucket, sql`${formEventsTable.type}`)
      .orderBy(eventBucket);

    const completions = await this.db
      .select({ at: sessionBucket, n: count() })
      .from(formSessionsTable)
      .where(
        and(
          inArray(formSessionsTable.formId, formIds),
          eq(formSessionsTable.status, "COMPLETED"),
          ...boundedSessions,
        ),
      )
      .groupBy(sessionBucket)
      .orderBy(sessionBucket);

    const map = new Map<string, { views: number; starts: number; submissions: number }>();
    const pointFor = (at: string) => {
      const existing = map.get(at);
      if (existing) return existing;
      const created = { views: 0, starts: 0, submissions: 0 };
      map.set(at, created);
      return created;
    };

    for (const row of events) {
      const point = pointFor(row.at);
      if (row.type === "VIEW") point.views += row.n;
      if (row.type === "START") point.starts += row.n;
    }

    for (const row of completions) {
      pointFor(row.at).submissions += row.n;
    }

    return [...map.entries()]
      .map(([at, point]) => ({ at, ...point }))
      .sort((a, b) => a.at.localeCompare(b.at));
  }

}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** A rate is always , rounded to three places. */
function rate(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 1000;
}

function chooseBucket(range: { from: Date | null; to: Date | null }): Bucket {
  const from = range.from ?? new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const to = range.to ?? new Date();
  const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);

  if (days > 400) return "month";
  if (days > 120) return "week";
  return "day";
}

/**
 * `date_trunc` for one of the three granularities, inlined as a literal.
 *
 * Postgres cannot resolve `date_trunc`'s overloads when the granularity is a bound
 * parameter, so it has to be a literal. `bucket` only ever holds one of the three
 * values `chooseBucket` returns, so nothing caller-supplied reaches the SQL text.
 */
function bucketExpression(bucket: Bucket, column: SQLWrapper): SQL<string> {
  switch (bucket) {
    case "week":
      return sql<string>`date_trunc('week', ${column})::text`;
    case "month":
      return sql<string>`date_trunc('month', ${column})::text`;
    default:
      return sql<string>`date_trunc('day', ${column})::text`;
  }
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
    : (sorted[middle] ?? 0);
}

/** Bucket durations into readable spans, capped at six so the chart stays legible. */
function histogram(durations: number[]): { label: string; min: number; max: number; count: number }[] {
  const BUCKETS = [
    { label: "under 30s", max: 30 },
    { label: "30s–1m", max: 60 },
    { label: "1–3m", max: 180 },
    { label: "3–5m", max: 300 },
    { label: "5–10m", max: 600 },
    { label: "over 10m", max: Number.POSITIVE_INFINITY },
  ];

  const counts = BUCKETS.map(() => 0);
  for (const seconds of durations) {
    const found = BUCKETS.findIndex((bucket) => seconds < bucket.max);
    const index = found === -1 ? BUCKETS.length - 1 : found;
    counts[index] = (counts[index] ?? 0) + 1;
  }

  let lower = 0;
  return BUCKETS.map((bucket, index) => {
    const entry = { label: bucket.label, min: lower, max: bucket.max, count: counts[index] ?? 0 };
    lower = bucket.max;
    return entry;
  });
}

function flattenJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(String)
      .join(", ");
  }
  return String(value);
}

function humanise(value: string, kind: string): string {
  if (kind === "YES_NO") return value === "true" ? "Yes" : "No";
  return value;
}

export default AnalyticsService;
