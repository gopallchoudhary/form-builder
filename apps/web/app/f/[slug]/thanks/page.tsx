import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

/**
 * Where a submission lands.
 *
 * The copy comes from the form's thank-you settings, which the respondent has already
 * seen the slug of — so this is a plain confirmation, and the settings redirect is
 * handled by the form itself.
 */
export default function ThanksPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8ebe6] px-4">
      <div className="max-w-sm rounded-xl bg-white p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[#0e0f0c]">
          Thank you
        </h1>
        <p className="mt-2 text-sm text-[#454745]">
          Your response has been recorded.
        </p>
      </div>
    </main>
  );
}
