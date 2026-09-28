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

    // Columns come from the form's questions, not from the answers — otherwise an
    // export with no responses would have no question columns at all, and one with
    // partial responses would have a different column set depending on who answered.
    const questions = await this.db
      .select({ id: questionsTable.id, label: questionsTable.label, labelKey: questionsTable.labelKey })
      .from(questionsTable)
      .where(and(eq(questionsTable.formId, formId), isNull(questionsTable.deletedAt)))
      .orderBy(asc(questionsTable.position));

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

    const header = [
      "Response",
      "Status",
      "Started at",
      "Completed at",
      "Duration (seconds)",
      ...questions.map((question) => question.label),
    ];

    const rows = sessions.map((session) => {
      const byQuestion = new Map(
        (answersBySession.get(session.sessionId) ?? []).map((answer) => [
          answer.questionId,
          stringifyAnswer(answer),
        ]),
      );

      return [
        session.sessionId,
        session.status,
        session.startedAt.toISOString(),
        session.completedAt?.toISOString() ?? "",
        durationInSeconds(session.startedAt, session.completedAt)?.toString() ?? "",
        ...questions.map((question) => byQuestion.get(question.id) ?? ""),
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

function stringifyAnswer(answer: ResponseAnswer): string {
  if (answer.valueText !== null) return answer.valueText;
  if (answer.valueNumber !== null) return formatNumericAnswer(answer.valueNumber) ?? answer.valueNumber;
  if (answer.valueDate !== null) return answer.valueDate;
  if (answer.valueJson !== null && answer.valueJson !== undefined) {
    if (Array.isArray(answer.valueJson)) return answer.valueJson.join("; ");
    if (typeof answer.valueJson === "object") {
      return Object.entries(answer.valueJson as Record<string, unknown>)
        .map(([key, value]) => `${key}: ${String(value)}`)
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
