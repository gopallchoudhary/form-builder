import { ChevronDownIcon } from "lucide-react";

import { ScrollReveal } from "./scroll-reveal";

const FAQ_ITEMS = [
  {
    question: "Do respondents need a Formora account?",
    answer:
      "No. People can open a public form or poll link and respond without creating a Formora account. A password-protected form still requires its password.",
  },
  {
    question: "Can someone change their poll vote?",
    answer: "Yes. While a poll is open, a voter can choose another option and update their vote.",
  },
  {
    question: "When do voters see poll results?",
    answer: "Voters see the results after they vote. Results update live while the poll is open.",
  },
  {
    question: "Can I password-protect a form?",
    answer:
      "Yes. You can protect a form with a password, and its contents stay hidden until a respondent enters it.",
  },
  {
    question: "What does Formora cost?",
    answer:
      "Pricing has not been announced. The cards above describe product workflows, not paid plans, prices, or feature limits.",
  },
] as const;

export function LandingFaq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="scroll-mt-20 bg-card py-16 sm:py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-muted-foreground text-xs font-bold tracking-[0.16em] uppercase">
            Good to know
          </p>
          <h2
            id="faq-heading"
            className="mt-3 text-3xl leading-tight font-black tracking-[-0.045em] sm:text-4xl"
          >
            A few quick answers.
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-7 sm:text-lg">
            What to expect when you create a form, share a poll, or invite people to respond.
          </p>
        </ScrollReveal>

        <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-3">
          {FAQ_ITEMS.map((item, index) => (
            <ScrollReveal key={item.question} delay={index * 35}>
              <details className="group rounded-2xl bg-muted p-1 dark:ring-1 dark:ring-border/70">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5">
                  <span>{item.question}</span>
                  <ChevronDownIcon
                    aria-hidden
                    className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="text-muted-foreground max-w-2xl px-4 pb-5 text-sm leading-6 sm:px-5">
                  {item.answer}
                </p>
              </details>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
