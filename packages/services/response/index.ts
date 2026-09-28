import { and, asc, count, db as defaultDb, desc, eq, gte, ilike, inArray, isNull, lte, or, type Database, sql } from "@repo/database";
import { formAnswersTable } from "@repo/database/models/form-answer";
import { formSessionsTable } from "@repo/database/models/form-session";
import { questionsTable } from "@repo/database/models/question";

import { formatNumericAnswer } from "../utils/answer-validation";
import { assertFormOwnership } from "../utils/ownership";
import {
  deleteResponseInput,
  type DeleteResponseInputType,
  listResponsesInput,
  type ListResponsesInputType,
  type ListResponsesOutput,
  type ResponseAnswer,
} from "./model";

const ANSWER_COLUMNS = {
  questionId: formAnswersTable.questionId,
  questionLabel: formAnswersTable.questionLabel,
  questionLabelKey: formAnswersTable.questionLabelKey,
  questionKind: formAnswersTable.questionKind,
  valueText: formAnswersTable.valueText,
  valueNumber: formAnswersTable.valueNumber,
  valueDate: formAnswersTable.valueDate,
  valueJson: formAnswersTable.valueJson,
} as const;

class ResponseService {
  constructor(private readonly db: Database = defaultDb) {}

  //. list a form's responses, newest first
  public async listResponses(userId: string, payload: ListResponsesInputType): Promise<ListResponsesOutput> {
    const { formId, page, pageSize, status, search, from, to } = await listResponsesInput.parseAsync(
      payload,
    );

    await assertFormOwnership(formId, userId, this.db);

    const filters = [eq(formSessionsTable.formId, formId)];
    if (status !== "ALL") filters.push(eq(formSessionsTable.status, status));
    if (from) filters.push(gte(formSessionsTable.startedAt, new Date(from)));
    if (to) filters.push(lte(formSessionsTable.startedAt, new Date(to)));

    const where = and(...filters);

    // A free-text search has to reach into the answers, so it filters on session ids
    // rather than adding another join to the page query.
    let sessionIds: string[] | null = null;
    if (search) {
      const matched = await this.db
        .selectDistinct({ sessionId: formAnswersTable.sessionId })
        .from(formAnswersTable)
        .where(
          and(
            eq(formAnswersTable.formId, formId),
            or(
              ilike(formAnswersTable.valueText, `%${search}%`),
              // jsonb has no ILIKE operator, so the value is compared as text.
              ilike(sql`${formAnswersTable.valueJson}::text`, `%${search}%`),
            ),
          ),
        );
      sessionIds = matched.map((row) => row.sessionId);
      if (sessionIds.length === 0) {
        return { total: 0, page, pageSize, responses: [] };
      }
    }

    const scope = sessionIds ? and(where, inArray(formSessionsTable.id, sessionIds)) : where;

    const [totals, sessions] = await Promise.all([
      this.db.select({ total: count() }).from(formSessionsTable).where(scope),
      this.db
        .select({
          sessionId: formSessionsTable.id,
          status: formSessionsTable.status,
          startedAt: formSessionsTable.startedAt,
          completedAt: formSessionsTable.completedAt,
        })
        .from(formSessionsTable)
        .where(scope)
        // The id is a tiebreaker: two responses can share a started_at to the
        // millisecond, and without a stable second key a row can be skipped or repeated
        // between pages.
        .orderBy(desc(formSessionsTable.startedAt), desc(formSessionsTable.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const answersBySession = await this.answersFor(
      sessions.map((session) => session.sessionId),
    );

    return {
      total: totals[0]?.total ?? 0,
      page,
      pageSize,
      responses: sessions.map((session) => ({
        sessionId: session.sessionId,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        durationSeconds: durationInSeconds(session.startedAt, session.completedAt),
        answers: answersBySession.get(session.sessionId) ?? [],
      })),
    };
  }

  /** Delete one response. Used when a creator removes a submission. */
  public async deleteResponse(userId: string, payload: DeleteResponseInputType) {
    const { formId, sessionId } = await deleteResponseInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);

    // Answers and events cascade from the session.
    await this.db
      .delete(formSessionsTable)
      .where(and(eq(formSessionsTable.id, sessionId), eq(formSessionsTable.formId, formId)));

    return { sessionId };
  }

  // ── CSV ──────────────────────────────────────────────────────────────────────

  /**
   * Export responses as CSV.
   *
   * Hand-rolled rather than pulling in a library: the only rules are quote-escaping a
   * value and prefixing a cell that could otherwise be read as a formula.
   */
  public async exportCsv(userId: string, payload: ListResponsesInputType): Promise<string> {
    const { formId } = await listResponsesInput.parseAsync(payload);

    await assertFormOwnership(formId, userId, this.db);

    const sessions = await this.db
      .select({
        sessionId: formSessionsTable.id,
        status: formSessionsTable.status,
        startedAt: formSessionsTable.startedAt,
        completedAt: formSessionsTable.completedAt,
      })
      .from(formSessionsTable)
      .where(eq(formSessionsTable.formId, formId))
      .orderBy(asc(formSessionsTable.startedAt));

    const answersBySession = await this.answersFor(sessions.map((session) => session.sessionId));
    const allAnswers = [...answersBySession.values()].flat();

    /*
     * Columns are the live questions *plus* every question that still has a recorded answer.
     *
     * Both halves are load-bearing. From the questions alone: a question nobody has answered
     * still belongs in the export, and a form with no responses at all would export no
     * question columns whatsoever. From the answers alone: a question the creator has since
     * deleted would take its entire column — and every value in it — out of the export, which
     * is the one thing a spreadsheet of collected responses must never do.
     *
     * A deleted question is headed by the label denormalised onto its answers, because that is
     * the only label those responses were ever collected under. Renaming a live question moves
     * its header, because the creator asked for that and the values are unchanged.
     */
    const live = await this.db
      .select({
        id: questionsTable.id,
        label: questionsTable.label,
        labelKey: questionsTable.labelKey,
        settings: questionsTable.settings,
      })
      .from(questionsTable)
      .where(and(eq(questionsTable.formId, formId), isNull(questionsTable.deletedAt)))
      .orderBy(asc(questionsTable.position));

    // Choice ids to the labels the respondents saw, for the cells below.
    const optionLabels = new Map<string, string>();
    for (const question of live) {
      const options = (question.settings as { options?: unknown } | null)?.options;
      if (!Array.isArray(options)) continue;
      for (const option of options as Array<{ id?: unknown; label?: unknown }>) {
        if (typeof option.id === "string" && typeof option.label === "string") {
          optionLabels.set(option.id, option.label);
        }
      }
    }

    const columns: Array<{ id: string; label: string }> = live.map((question) => ({
      id: question.id,
      label: question.label,
    }));

    const liveIds = new Set(live.map((question) => question.id));
    const orphans = new Map<string, string>();

    for (const answer of allAnswers) {
      if (liveIds.has(answer.questionId) || orphans.has(answer.questionId)) continue;
      orphans.set(answer.questionId, answer.questionLabel ?? answer.questionLabelKey ?? "Deleted question");
    }

    // Appended after the live questions, sorted by the label they were recorded under, so the
    // order of a re-imported file does not shuffle between exports.
    for (const [id, label] of [...orphans.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
      columns.push({ id, label });
    }

    const header = [
      "Response",
      "Status",
      "Started at",
      "Completed at",
      "Duration (seconds)",
      ...columns.map((column) => column.label),
    ];

    const rows = sessions.map((session) => {
      const byQuestion = new Map(
        (answersBySession.get(session.sessionId) ?? []).map((answer) => [
          answer.questionId,
          stringifyAnswer(answer, optionLabels),
        ]),
      );

      return [
        session.sessionId,
        session.status,
        session.startedAt.toISOString(),
        session.completedAt?.toISOString() ?? "",
        durationInSeconds(session.startedAt, session.completedAt)?.toString() ?? "",
        ...columns.map((column) => byQuestion.get(column.id) ?? ""),
      ];
    });

    return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async answersFor(sessionIds: string[]): Promise<Map<string, ResponseAnswer[]>> {
    if (sessionIds.length === 0) return new Map();

    const rows = await this.db
      .select({ sessionId: formAnswersTable.sessionId, ...ANSWER_COLUMNS })
      .from(formAnswersTable)
      .where(inArray(formAnswersTable.sessionId, sessionIds))
      .orderBy(asc(formAnswersTable.createdAt));

    const grouped = new Map<string, ResponseAnswer[]>();
    for (const row of rows) {
      const list = grouped.get(row.sessionId) ?? [];
      list.push({
        questionId: row.questionId,
        questionLabel: row.questionLabel,
        questionLabelKey: row.questionLabelKey,
        questionKind: row.questionKind,
        valueText: row.valueText,
        valueNumber: formatNumericAnswer(row.valueNumber),
        valueDate: row.valueDate,
        valueJson: row.valueJson,
      });
      grouped.set(row.sessionId, list);
    }

    return grouped;
  }
}

function durationInSeconds(startedAt: Date, completedAt: Date | null): number | null {
  if (!completedAt) return null;
  return Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
}

/**
 * Human labels for the address fields, so an exported cell reads "City: London" rather than
 * `city: London`. The raw keys are what the JSON holds; they are not what a person means.
 */
const ADDRESS_FIELD_LABELS: Record<string, string> = {
  line1: "Address",
  line2: "Apartment, suite",
  city: "City",
  state: "State",
  postalCode: "Postal code",
  country: "Country",
};

/**
 * Render one answer as a spreadsheet cell.
 *
 * `optionLabels` maps a choice's stored id to the label the respondent actually saw. Only the
 * ids were recorded, so without this a multi-select exports as `api; ui` — which is the
 * database's vocabulary, not the form's. An id with no matching option is left as itself,
 * which is the honest rendering for a question the creator has since edited.
 */
function stringifyAnswer(
  answer: ResponseAnswer,
  optionLabels: Map<string, string> = new Map(),
): string {
  if (answer.valueText !== null) return answer.valueText;
  if (answer.valueNumber !== null) return formatNumericAnswer(answer.valueNumber) ?? answer.valueNumber;
  if (answer.valueDate !== null) return answer.valueDate;

  if (answer.valueJson !== null && answer.valueJson !== undefined) {
    if (Array.isArray(answer.valueJson)) {
      return answer.valueJson
        .map(String)
        .map((id) => optionLabels.get(id) ?? id)
        .join("; ");
    }

    if (typeof answer.valueJson === "object") {
      return Object.entries(answer.valueJson as Record<string, unknown>)
        .map(([key, value]) => `${ADDRESS_FIELD_LABELS[key] ?? key}: ${String(value)}`)
        .join("; ");
    }

    return String(answer.valueJson);
  }

  return "";
}

/**
 * Quote a CSV cell, and defuse a leading `=`, `+`, `-` or `@`, which a spreadsheet
 * would otherwise treat as a formula when the creator opens the export.
 */
export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export default ResponseService;
