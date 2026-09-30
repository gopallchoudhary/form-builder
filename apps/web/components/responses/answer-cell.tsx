import { StarIcon } from "lucide-react";
import type { RouterOutputs } from "@repo/trpc/client";

/**
 * The answer shape, taken from the router's output rather than restated.
 *
 * `valueJson` is optional here — `z.unknown()` infers an optional key — so every read of it
 * is guarded, and the cells that depend on it are the ones that already handle a missing
 * value.
 */
export type ResponseAnswer =
  RouterOutputs["response"]["listResponses"]["responses"][number]["answers"][number];

/**
 * One answer, as a person would read it.
 *
 * The stored shape depends on the question's kind — text in `value_text`, ratings and
 * numbers in `value_number`, dates in `value_date`, and multi-selects and addresses in
 * `value_json` — so rendering has to know the kind rather than just having a value. A
 * rating of 5 arrives as the string `"5"` from a `numeric` column, and is shown as a score
 * out of its own scale rather than as a bare number, because the number is not what it means.
 *
 * `settings` is the question's *current* configuration, used for two things the answer
 * cannot supply: the scale a rating was out of, and the labels behind the ids a
 * multi-select stored. Both are best-effort — an option the creator has since deleted
 * falls back to its id rather than disappearing.
 */

const ADDRESS_LABELS: Record<string, string> = {
  line1: "Address",
  line2: "Apt",
  city: "City",
  state: "State",
  postalCode: "Postcode",
  country: "Country",
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** "5.000000" from a numeric column, shown the way a person would write it. */
function asNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionsFrom(settings: unknown): Array<{ id: string; label: string }> {
  const options = asRecord(settings).options;
  return Array.isArray(options) ? (options as Array<{ id: string; label: string }>) : [];
}

function ratingMax(settings: unknown): number {
  const scale = asRecord(settings).scale;
  return typeof scale === "number" && scale > 0 ? scale : 5;
}

export function AnswerCell({
  answer,
  settings,
}: {
  answer: ResponseAnswer;
  /** The question's current settings, for scale and option labels. */
  settings?: unknown;
}) {
  const kind = answer.questionKind ?? "";

  if (kind === "ADDRESS") {
    const address = asRecord(answer.valueJson);
    const parts = Object.entries(address)
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
      .map(([key, value]) => (
        <span key={key}>
          <span className="text-muted-foreground">{ADDRESS_LABELS[key] ?? key}: </span>
          {String(value)}
        </span>
      ));

    if (parts.length === 0) return <Dash />;

    // Stacked rather than run together, so the lines stay readable in a narrow column.
    return (
      <span className="flex flex-col gap-0.5">
        {parts.map((part) => (
          <span key={part.key}>{part}</span>
        ))}
      </span>
    );
  }

  if (kind === "MULTI_CHOICE") {
    const selected = Array.isArray(answer.valueJson)
      ? (answer.valueJson as unknown[]).map(String)
      : [];
    if (selected.length === 0) return <Dash />;

    // Only the ids were recorded, so the labels are looked up from the question's current
    // options. A renamed option reads with its new name; one that has been deleted keeps
    // its id, which is honest about a response the creator can no longer interpret.
    const labels = new Map(optionsFrom(settings).map((option) => [option.id, option.label]));

    return (
      <span className="flex flex-wrap gap-1">
        {selected.map((entry) => (
          <span
            key={entry}
            title={labels.has(entry) ? undefined : "This option no longer exists"}
            className="bg-secondary text-secondary-foreground rounded-pill px-2 py-0.5 text-xs"
          >
            {labels.get(entry) ?? entry}
          </span>
        ))}
      </span>
    );
  }

  if (kind === "RATING") {
    const value = asNumber(answer.valueNumber);
    if (value === null) return <Dash />;
    const max = ratingMax(settings);

    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {max <= 10 &&
          Array.from({ length: max }, (_, index) => index + 1).map((point) => (
            <StarIcon
              key={point}
              aria-hidden
              className={[
                "size-3",
                point <= value ? "fill-primary text-positive" : "text-muted-foreground/25",
              ].join(" ")}
            />
          ))}
        <span className="ml-1 text-xs font-medium">
          {value} / {max}
        </span>
      </span>
    );
  }

  if (kind === "YES_NO") {
    if (answer.valueText === null || answer.valueText === undefined) return <Dash />;
    const saidYes = answer.valueText === "true";
    return (
      <span
        className={[
          "rounded-pill px-2 py-0.5 text-xs font-medium",
          saidYes
            ? "bg-positive-subtle text-positive-foreground"
            : "bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {saidYes ? "Yes" : "No"}
      </span>
    );
  }

  if (kind === "NUMBER") {
    const value = asNumber(answer.valueNumber);
    return value === null ? <Dash /> : <span className="font-mono text-xs">{value}</span>;
  }

  if (kind === "DATE") {
    if (!answer.valueDate) return <Dash />;
    // Stored as a plain `YYYY-MM-DD`, never a Date, so no timezone can shift the day.
    const parsed = new Date(`${answer.valueDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return <span>{answer.valueDate}</span>;
    return (
      <span className="whitespace-nowrap">
        {parsed.toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })}
      </span>
    );
  }

  if (!answer.valueText) return <Dash />;
  return <span className="line-clamp-3 break-words">{answer.valueText}</span>;
}

function Dash() {
  return <span className="text-muted-foreground/50">—</span>;
}
