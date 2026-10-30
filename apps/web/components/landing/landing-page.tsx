import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  Link2Icon,
  MessagesSquareIcon,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { ProductMark } from "~/components/product-mark";

import { DashboardPreview } from "./dashboard-preview";
import { LandingFaq } from "./landing-faq";
import { LandingNavbar } from "./landing-navbar";
import { ProductShowcase } from "./product-showcase";
import { ScrollReveal } from "./scroll-reveal";
import styles from "./landing-motion.module.css";

const STEPS = [
  {
    number: "01",
    icon: FileTextIcon,
    title: "Build your question",
    body: "Create a thoughtful form for detailed answers, or a quick poll when you need a clear choice.",
    className: "bg-card dark:ring-1 dark:ring-border/70",
  },
  {
    number: "02",
    icon: Link2Icon,
    title: "Share one simple link",
    body: "Send it where your audience already is. No account is needed to respond or vote.",
    className: "bg-secondary",
  },
  {
    number: "03",
    icon: MessagesSquareIcon,
    title: "See what people say",
    body: "Follow form responses, watch poll totals move, and understand the feedback in one workspace.",
    className: "bg-card dark:ring-1 dark:ring-border/70",
  },
] as const;

const USE_CASES = [
  {
    name: "Collect detailed feedback",
    audience: "FORMS",
    description:
      "Invite people to explain what they think, then review their responses in your workspace.",
    features: [
      "Share a public form link",
      "Collect written answers",
      "Password-protect access when needed",
    ],
    featured: false,
  },
  {
    name: "Make a group decision",
    audience: "LIVE POLLS",
    description: "Put a choice to the group and follow the result as votes arrive.",
    features: [
      "Vote from a shared link",
      "See results after voting",
      "Change a vote while the poll is open",
    ],
    featured: true,
  },
  {
    name: "Follow the feedback",
    audience: "ONE WORKSPACE",
    description: "Keep detailed responses and quick poll results together in the same workspace.",
    features: [
      "Manage forms and polls together",
      "Review form responses",
      "Follow results as poll votes arrive",
    ],
    featured: false,
  },
] as const;

/**
 * Public Formora landing page.
 *
 * The page shows both sides of the feedback loop: a creator workspace above and sample public
 * form/poll experiences below. The previews use illustrative content, never creator data.
 *
 * Surfaces use the site's existing semantic tokens, so visitors keep their selected theme.
 * In the light palette, the hero is sage over white content; in dark, it becomes ink over
 * the same card rhythm. The fixed ink footer is an explicit DESIGN.md brand band.
 */
export function LandingPage() {
  return (
    <main id="top" className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <section className="overflow-hidden bg-muted">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 lg:px-8 lg:py-20 xl:py-24">
          <div className="relative z-10 max-w-2xl">
            <div
              className={`${styles.rise} mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground`}
            >
              <span aria-hidden className="bg-primary size-2 rounded-full" />
              Forms and live polls, together
            </div>

            <h1
              className={`${styles.rise} max-w-[760px] text-[clamp(3.25rem,6.2vw,5.5rem)] leading-[0.91] font-black tracking-[-0.065em]`}
              style={{ animationDelay: "40ms" }}
            >
              <span className="block">Build forms.</span>
              <span className="block">Run live polls.</span>
            </h1>

            <p
              className={`${styles.rise} text-muted-foreground mt-6 max-w-xl text-lg leading-7 sm:text-xl sm:leading-8`}
              style={{ animationDelay: "80ms" }}
            >
              Collect thoughtful answers, share a quick vote, and see both take shape in one clear
              workspace.
            </p>

            <div
              className={`${styles.rise} mt-8 flex flex-col gap-3 sm:flex-row sm:items-center`}
              style={{ animationDelay: "120ms" }}
            >
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl px-6 text-base motion-safe:active:scale-[0.98]"
              >
                <Link href="/signup">
                  Create your first form or poll
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-xl px-6 text-base motion-safe:active:scale-[0.98]"
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>

            <p
              className={`${styles.rise} text-muted-foreground mt-5 text-xs sm:text-sm`}
              style={{ animationDelay: "160ms" }}
            >
              Your audience can respond from a public link—no Formora account needed.
            </p>
          </div>

          <div
            className={`${styles.preview} relative min-w-0 lg:-mr-8 xl:-mr-14`}
            style={{ animationDelay: "90ms" }}
          >
            <DashboardPreview />
          </div>
        </div>
      </section>

      <ProductShowcase />

      <section id="how-it-works" className="scroll-mt-20 bg-muted py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="max-w-2xl">
            <p className="text-muted-foreground text-xs font-bold tracking-[0.16em] uppercase">
              A simple feedback loop
            </p>
            <h2 className="mt-3 text-3xl leading-tight font-black tracking-[-0.045em] sm:text-4xl">
              From first question to clear next step.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl text-base leading-7 sm:text-lg">
              Formora keeps the process light for you and straightforward for the people you ask.
            </p>
          </ScrollReveal>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <ScrollReveal key={step.number} delay={index * 70} className="h-full">
                  <article
                    className={`${step.className} flex h-full min-h-[250px] flex-col rounded-3xl p-6 transition-[translate,box-shadow] duration-300 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg motion-safe:hover:shadow-foreground/5 motion-reduce:transition-none sm:p-7`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold tracking-[0.12em] text-muted-foreground">
                        {step.number}
                      </span>
                      <span className="flex size-10 items-center justify-center rounded-full bg-background text-foreground">
                        <Icon aria-hidden className="size-5" />
                      </span>
                    </div>
                    <h3 className="mt-8 text-xl font-bold tracking-tight">{step.title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">{step.body}</p>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="ways-to-use"
        aria-labelledby="ways-to-use-heading"
        className="scroll-mt-20 bg-muted py-16 sm:py-20 lg:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="mx-auto max-w-2xl text-center">
            <p className="text-muted-foreground text-xs font-bold tracking-[0.16em] uppercase">
              Ways to use Formora
            </p>
            <h2
              id="ways-to-use-heading"
              className="mt-3 text-3xl leading-tight font-black tracking-[-0.045em] sm:text-4xl"
            >
              One workspace for the full feedback loop.
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-7 sm:text-lg">
              Start with a detailed question, a quick poll, or both. These are product workflows,
              not paid tiers; pricing has not been announced.
            </p>
          </ScrollReveal>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            {USE_CASES.map((useCase, index) => (
              <ScrollReveal key={useCase.name} delay={index * 70} className="h-full">
                <article
                  className={`flex h-full flex-col rounded-3xl p-6 transition-[translate,box-shadow] duration-300 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg motion-safe:hover:shadow-foreground/5 motion-reduce:transition-none sm:p-7 ${
                    useCase.featured
                      ? "bg-foreground text-background"
                      : "bg-card text-card-foreground"
                  }`}
                >
                  <p
                    className={
                      useCase.featured
                        ? "text-primary text-xs font-bold tracking-[0.14em] uppercase"
                        : "text-muted-foreground text-xs font-bold tracking-[0.14em] uppercase"
                    }
                  >
                    {useCase.audience}
                  </p>
                  <h3 className="mt-4 text-2xl font-black tracking-tight">{useCase.name}</h3>
                  <p
                    className={
                      useCase.featured
                        ? "mt-5 min-h-12 text-sm leading-6 text-background/80"
                        : "text-muted-foreground mt-5 min-h-12 text-sm leading-6"
                    }
                  >
                    {useCase.description}
                  </p>

                  <ul className="mt-5 flex flex-1 flex-col gap-3">
                    {useCase.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm">
                        <CheckIcon
                          aria-hidden
                          className={
                            useCase.featured
                              ? "text-primary mt-0.5 size-4 shrink-0"
                              : "text-positive mt-0.5 size-4 shrink-0"
                          }
                        />
                        <span
                          className={useCase.featured ? "text-background/90" : "text-foreground/85"}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    variant={useCase.featured ? "default" : "outline"}
                    className="mt-8 h-12 w-full rounded-xl text-base motion-safe:active:scale-[0.98]"
                  >
                    <Link href="/signup">Create your account</Link>
                  </Button>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <LandingFaq />

      <section className="bg-secondary py-14 sm:py-16">
        <ScrollReveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-[0.16em] text-secondary-foreground/70 uppercase">
                Your next question starts here
              </p>
              <h2 className="mt-3 text-3xl leading-tight font-black tracking-[-0.045em] sm:text-4xl">
                Make room for better answers.
              </h2>
            </div>
            <Button
              asChild
              size="lg"
              className="h-12 shrink-0 rounded-xl px-6 text-base motion-safe:active:scale-[0.98]"
            >
              <Link href="/signup">
                Get started
                <ArrowRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
        </ScrollReveal>
      </section>

      <footer className="bg-brand-ink text-brand-canvas-soft">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
            <div className="max-w-sm">
              <ProductMark className="self-start text-base text-brand-canvas-soft hover:text-white" />
              <p className="mt-4 text-sm leading-6 text-brand-canvas-soft/70">
                Forms for the details. Polls for the decisions. One thoughtful place to hear from
                people.
              </p>
            </div>
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold"
            >
              <a
                className="text-brand-canvas-soft/80 transition-colors hover:text-white"
                href="#forms-and-polls"
              >
                Forms & polls
              </a>
              <a
                className="text-brand-canvas-soft/80 transition-colors hover:text-white"
                href="#how-it-works"
              >
                How it works
              </a>
              <a
                className="text-brand-canvas-soft/80 transition-colors hover:text-white"
                href="#ways-to-use"
              >
                Ways to use
              </a>
              <a
                className="text-brand-canvas-soft/80 transition-colors hover:text-white"
                href="#faq"
              >
                FAQ
              </a>
              <Link
                className="text-brand-canvas-soft/80 transition-colors hover:text-white"
                href="/login"
              >
                Log in
              </Link>
              <Link
                className="text-brand-canvas-soft/80 transition-colors hover:text-white"
                href="/signup"
              >
                Create account
              </Link>
            </nav>
          </div>
          <div className="flex flex-col gap-2 border-t border-brand-canvas-soft/20 pt-5 text-xs text-brand-canvas-soft/60 sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} Formora</span>
            <span>Forms and live polls, made clear.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
