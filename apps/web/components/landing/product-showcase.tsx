import { ChartNoAxesColumnIncreasingIcon, CheckIcon, FileTextIcon, Link2Icon } from "lucide-react";

import { ScrollReveal } from "./scroll-reveal";

const FORM_FEATURES = [
  "Share a public form link",
  "Review collected responses",
  "Add password protection when needed",
] as const;

const POLL_FEATURES = [
  "See results after voting",
  "Watch results update while the poll is open",
  "Change a vote while the poll is open",
] as const;

/** Product and respondent views, built from UI primitives and labeled as sample content. */
export function ProductShowcase() {
  return (
    <section
      id="forms-and-polls"
      aria-labelledby="forms-and-polls-heading"
      className="scroll-mt-20 bg-card py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="max-w-2xl">
          <p className="text-muted-foreground text-xs font-bold tracking-[0.16em] uppercase">
            Two ways to ask
          </p>
          <h2
            id="forms-and-polls-heading"
            className="mt-3 text-3xl leading-tight font-black tracking-[-0.045em] sm:text-4xl"
          >
            Get the kind of feedback you need.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl text-base leading-7 sm:text-lg">
            Use a form when you need the full story. Use a live poll when the group needs to make a
            quick choice.
          </p>
        </ScrollReveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          <ScrollReveal className="h-full">
            <article className="flex h-full flex-col rounded-3xl bg-muted p-6 dark:ring-1 dark:ring-border/70 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-card text-foreground">
                  <FileTextIcon aria-hidden className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">Forms</p>
                  <p className="text-muted-foreground text-xs">For detailed feedback</p>
                </div>
              </div>

              <h3 className="mt-6 text-xl font-bold tracking-tight sm:text-2xl">
                Make room for a thoughtful answer.
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                Ask a question that needs more than a quick vote, then review responses in your
                workspace.
              </p>

              <ul className="mt-5 flex flex-col gap-2.5">
                {FORM_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <CheckIcon aria-hidden className="text-positive mt-0.5 size-4 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <PublicFormPreview />
            </article>
          </ScrollReveal>

          <ScrollReveal delay={90} className="h-full">
            <article className="flex h-full flex-col rounded-3xl bg-foreground p-6 text-background sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-background text-foreground">
                  <ChartNoAxesColumnIncreasingIcon aria-hidden className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-bold">Live polls</p>
                  <p className="text-background/65 text-xs">For quick group choices</p>
                </div>
              </div>

              <h3 className="mt-6 text-xl font-bold tracking-tight sm:text-2xl">
                Let everyone help decide.
              </h3>
              <p className="text-background/75 mt-2 text-sm leading-6">
                Share a poll link, collect votes, and follow the result as it changes.
              </p>

              <ul className="mt-5 flex flex-col gap-2.5">
                {POLL_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <CheckIcon aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
                    <span className="text-background/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <PublicPollPreview />
            </article>
          </ScrollReveal>
        </div>

        <ScrollReveal className="mt-5">
          <aside className="flex flex-col gap-4 rounded-3xl bg-secondary p-5 text-secondary-foreground sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3 sm:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card">
                <Link2Icon aria-hidden className="text-foreground size-5" />
              </span>
              <div>
                <h3 className="font-bold">Easy for the people you ask</h3>
                <p className="text-secondary-foreground/80 mt-1 text-sm leading-6">
                  Respondents can answer from a public link without creating a Formora account.
                </p>
              </div>
            </div>
            <span className="w-fit rounded-full bg-card px-3 py-1.5 text-xs font-bold">
              No account needed
            </span>
          </aside>
        </ScrollReveal>
      </div>
    </section>
  );
}

function PublicFormPreview() {
  return (
    <div
      role="img"
      aria-label="Sample public form respondent view with a written-answer question."
      className="mt-7 rounded-2xl border border-border/70 bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[9px] font-bold tracking-[0.14em] uppercase">
          Public form
        </span>
        <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-1 text-[9px] font-bold">
          SAMPLE
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold">What could we make easier?</p>
      <div className="text-muted-foreground mt-3 min-h-14 rounded-xl border border-border bg-background px-3 py-3 text-xs">
        Write your answer…
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[10px]">Shared by the creator</span>
        <span className="bg-primary text-primary-foreground rounded-xl px-3 py-2 text-[10px] font-bold">
          Submit response
        </span>
      </div>
    </div>
  );
}

function PublicPollPreview() {
  return (
    <div
      role="img"
      aria-label="Sample public poll respondent view before voting, with two options and a vote action."
      className="mt-7 rounded-2xl border border-border/70 bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[9px] font-bold tracking-[0.14em] uppercase">
          Public poll
        </span>
        <span className="bg-positive-subtle text-positive-foreground rounded-full px-2 py-1 text-[9px] font-bold">
          OPEN · SAMPLE
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold">Where should we meet?</p>
      <div className="mt-3 flex flex-col gap-2">
        <PollChoice label="Ramen House" />
        <PollChoice label="Garden Café" />
      </div>
      <div className="bg-primary text-primary-foreground mt-3 rounded-xl px-3 py-2 text-center text-[10px] font-bold">
        Vote
      </div>
      <p className="text-muted-foreground mt-2 text-center text-[10px]">
        Results appear after you vote
      </p>
    </div>
  );
}

function PollChoice({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 text-xs font-medium">
      <span aria-hidden className="size-4 rounded-full border border-border" />
      <span>{label}</span>
    </div>
  );
}
