"use client";

import { AlertTriangleIcon, InboxIcon } from "lucide-react";
import type { RouterOutputs } from "@repo/trpc/client";

import { AnswerCell } from "~/components/responses/answer-cell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

/**
 * The responses table: one row per response, one column per question.
 *
 * Columns come from the form's live questions, ordered by position, and each cell renders
 * the answer that was *recorded* — so renaming a question changes the header immediately
 * without rewriting history, and a deleted question's answers stop having a column rather
 * than vanishing from the data underneath.
 */

/** Exactly what `listResponses` sends, rather than a restatement of it. */
export type ResponseRow =
  RouterOutputs["response"]["listResponses"]["responses"][number];

type RowStatus = ResponseRow["status"];

export interface QuestionColumn {
  id: string;
  label: string;
  labelKey: string;
  settings: unknown;
}

const STATUS: Record<RowStatus, { label: string; className: string }> = {
  COMPLETED: { label: "Complete", className: "bg-[#e2f6d5] text-[#054d28]" },
  IN_PROGRESS: { label: "In progress", className: "bg-[#e2f6d5] text-[#b86700]" },
  ABANDONED: { label: "Abandoned", className: "bg-muted text-muted-foreground" },
};

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function ResponseTable({
  rows,
  questions,
  isLoading,
  onDelete,
  deletingSessionId,
}: {
  rows: ResponseRow[];
  questions: QuestionColumn[];
  isLoading?: boolean;
  onDelete?: (sessionId: string) => void;
  deletingSessionId?: string | null;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/60 py-20 text-center">
        <span className="bg-muted flex size-14 items-center justify-center rounded-full">
          <InboxIcon className="text-muted-foreground size-6" />
        </span>
        <div>
          <p className="font-medium">No responses yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {questions.length === 0
              ? "Add a question and publish the form to start collecting responses."
              : "Share the form. Responses will appear here as they arrive."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
      <Table>
        <caption className="sr-only">Responses to this form</caption>

        {/*
          `ex-data-table-cell`: canvas-soft header, mono-caps eyebrow typography, body-sm
          cells, and a canvas-soft row border. The eyebrow is the question's stable key —
          not decoration, but the column name an export will use.
        */}
        <TableHeader className="bg-[#e8ebe6]">
          <TableRow className="hover:bg-[#e8ebe6]">
            <TableHead className="w-40 font-mono text-[10px] tracking-widest uppercase">
              Response
            </TableHead>
            <TableHead className="w-28 font-mono text-[10px] tracking-widest uppercase">
              Status
            </TableHead>
            <TableHead className="w-40 font-mono text-[10px] tracking-widest uppercase">
              Started
            </TableHead>
            <TableHead className="w-24 font-mono text-[10px] tracking-widest uppercase">
              Duration
            </TableHead>

            {questions.map((question) => (
              <TableHead
                key={question.id}
                className="min-w-48 font-mono text-[10px] tracking-widest uppercase"
              >
                <span className="block font-mono text-[10px] tracking-widest uppercase">
                  {question.labelKey}
                </span>
                <span className="text-muted-foreground mt-0.5 block font-sans text-xs font-normal tracking-normal normal-case">
                  {question.label}
                </span>
              </TableHead>
            ))}

            {onDelete && (
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => {
            const byQuestion = new Map(row.answers.map((answer) => [answer.questionId, answer]));
            const status = STATUS[row.status];

            return (
              <TableRow key={row.sessionId} className="border-[#e8ebe6]">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {row.sessionId.slice(0, 8)}
                </TableCell>
                <TableCell>
                  <Badge className={`rounded-pill ${status.className}`}>{status.label}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(row.startedAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDuration(row.durationSeconds)}
                </TableCell>

                {questions.map((question) => {
                  const answer = byQuestion.get(question.id);
                  return (
                    <TableCell key={question.id} className="max-w-64 text-sm align-top">
                      {answer ? (
                        <AnswerCell answer={answer} settings={question.settings} />
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                  );
                })}

                {onDelete && (
                  <TableCell>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete the response from ${formatDate(row.startedAt)}`}
                      disabled={deletingSessionId === row.sessionId}
                      className="hover:text-destructive"
                      onClick={() => onDelete(row.sessionId)}
                    >
                      <AlertTriangleIcon className="size-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
