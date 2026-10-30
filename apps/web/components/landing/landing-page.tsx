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
import { LandingNavbar } from "./landing-navbar";
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

const PLAN_CARDS = [
  {
    name: "Gather",
    audience: "For thoughtful feedback",
    description: "Give people room to explain what they think.",
    features: ["Build shareable forms", "Collect written responses", "Review response trends"],
    featured: false,
  },
  {
    name: "Decide",
    audience: "For quick group choices",
    description: "Turn a question into a live vote and see the result take shape.",
    features: ["Create live polls", "Share a public voting link", "Watch totals update live"],
    featured: true,
  },
  {
    name: "Understand",
    audience: "For the full feedback loop",
    description: "Bring forms, polls, and their results into one clear workspace.",
    features: ["Forms and polls together", "Response analytics", "Poll insights over time"],
    featured: false,
  },
] as const;

/**
 * Public Formora landing page.
 *
 * The composition has one visual risk and everything else stays quiet: the screenshot-like
 * workspace preview carries a live poll card over the dashboard frame. It shows the
 * product's distinctive combination — structured forms and quick decisions — without
 * borrowing the generic gradient-and-floating-stat-card language that could belong to any
 * SaaS landing page.
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
            <div className={`${styles.rise} mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground`}>
              <span aria-hidden className="bg-primary size-2 rounded-full" />
              Forms and live polls, together
            </div>

            <h1
              className={`${styles.rise} max-w-[760px] text-[clamp(3.25rem,6.2vw,5.5rem)] leading-[0.91] font-black tracking-[-0.065em]`}
              style={{ animationDelay: "50ms" }}
            >
              <span className="block">Build forms.</span>
              <span className="block">Run live polls.</span>
            </h1>

            <p
              className={`${styles.rise} text-muted-foreground mt-6 max-w-xl text-lg leading-7 sm:text-xl sm:leading-8`}
              style={{ animationDelay: "100ms" }}
            >
              Collect thoughtful answers, share a quick vote, and see both take shape in one
              clear workspace.
            </p>

            <div
              className={`${styles.rise} mt-8 flex flex-col gap-3 sm:flex-row sm:items-center`}
              style={{ animationDelay: "150ms" }}
            >
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl px-6 text-base motion-safe:active:scale-[0.98]"
              >
                <Link href="/signup">
                  Create your account
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
              style={{ animationDelay: "200ms" }}
            >
              Start with a form or a poll. Your audience can respond from a link.
            </p>
          </div>

          <div
            className={`${styles.preview} relative min-w-0 lg:-mr-8 xl:-mr-14`}
            style={{ animationDelay: "120ms" }}
          >
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 bg-muted py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-muted-foreground text-xs font-bold tracking-[0.16em] uppercase">
              A simple feedback loop
            </p>
            <h2 className="mt-3 text-3xl leading-tight font-black tracking-[-0.045em] sm:text-4xl">
              From first question to clear next step.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl text-base leading-7 sm:text-lg">
              Formora keeps the process light for you and straightforward for the people you ask.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.number}
                  className={`${step.className} flex min-h-[250px] flex-col rounded-3xl p-6 transition-[translate,box-shadow] duration-300 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg motion-safe:hover:shadow-foreground/5 sm:p-7`}
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
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 bg-muted py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-muted-foreground text-xs font-bold tracking-[0.16em] uppercase">
              Pricing preview · illustrative
            </p>
            <h2 className="mt-3 text-3xl leading-tight font-black tracking-[-0.045em] sm:text-4xl">
              Start with what you need.
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-7 sm:text-lg">
              These cards show ways to use Formora, not paid tiers or feature limits. Pricing is
              still to be announced.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            {PLAN_CARDS.map((plan) => (
              <article
                key={plan.name}
                className={`flex flex-col rounded-3xl p-6 transition-[translate,box-shadow] duration-300 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg motion-safe:hover:shadow-foreground/5 sm:p-7 ${
                  plan.featured
                    ? "bg-foreground text-background"
                    : "bg-card text-card-foreground"
                }`}
              >
                <p
                  className={
                    plan.featured
                      ? "text-primary text-xs font-bold tracking-[0.14em] uppercase"
                      : "text-muted-foreground text-xs font-bold tracking-[0.14em] uppercase"
                  }
                >
                  Illustrative plan
                </p>
                <h3 className="mt-4 text-2xl font-black tracking-tight">{plan.name}</h3>
                <p
                  className={
                    plan.featured
                      ? "mt-1 text-sm font-semibold text-background/75"
                      : "text-muted-foreground mt-1 text-sm font-semibold"
                  }
                >
                  {plan.audience}
                </p>
                <p
                  className={
                    plan.featured
                      ? "mt-5 min-h-12 text-sm leading-6 text-background/80"
                      : "text-muted-foreground mt-5 min-h-12 text-sm leading-6"
                  }
                >
                  {plan.description}
                </p>

                <ul className="mt-5 flex flex-1 flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <CheckIcon
                        aria-hidden
                        className={plan.featured ? "text-primary mt-0.5 size-4 shrink-0" : "text-positive mt-0.5 size-4 shrink-0"}
                      />
                      <span className={plan.featured ? "text-background/90" : "text-foreground/85"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={plan.featured ? "default" : "outline"}
                  className="mt-8 h-12 w-full rounded-xl text-base motion-safe:active:scale-[0.98]"
                >
                  <Link href="/signup">Create your account</Link>
                </Button>
              </article>
            ))}
          </div>

          <p className="text-muted-foreground mt-5 text-center text-xs">
            No prices, billing terms, or feature limits are being represented here.
          </p>
        </div>
      </section>

      <section className="bg-secondary py-14 sm:py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
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
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold">
              <a className="text-brand-canvas-soft/80 transition-colors hover:text-white" href="#how-it-works">
                How it works
              </a>
              <a className="text-brand-canvas-soft/80 transition-colors hover:text-white" href="#pricing">
                Pricing preview
              </a>
              <Link className="text-brand-canvas-soft/80 transition-colors hover:text-white" href="/login">
                Log in
              </Link>
              <Link className="text-brand-canvas-soft/80 transition-colors hover:text-white" href="/signup">
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
