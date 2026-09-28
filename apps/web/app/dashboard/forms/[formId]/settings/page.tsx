"use client";

import { useParams } from "next/navigation";

import { FormTabs } from "~/components/form-tabs";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { useGetFormSettings } from "~/hooks/api/form";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

/**
 * Read-only for now. The settings editor — theme picker, password toggle, limits — is
 * Phase 5; this page exists so the route, the tab and the settings query are real.
 */
export default function FormSettingsPage() {
  const { formId } = useParams<{ formId: string }>();
  const { form, isLoading, isError, error } = useGetFormSettings(formId);

  return (
    <div className="flex flex-1 flex-col">
      <FormTabs formId={formId} />

      <div className="mx-auto w-full max-w-2xl p-6">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

        {isLoading && (
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-destructive mt-6 text-sm">
            {error?.message ?? "Could not load this form."}
          </p>
        )}

        {form && (
          <div className="mt-6">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-base font-medium">{form.title}</h2>
              <Badge variant="secondary">{form.status}</Badge>
            </div>
            <Row label="Share slug" value={`/f/${form.slug}`} />
            <Row label="Layout" value={form.layoutMode} />
            <Row label="Theme" value={form.themeKey} />
            <Row label="Show progress" value={form.showProgress ? "Yes" : "No"} />
            <Row label="Allow back" value={form.allowBack ? "Yes" : "No"} />
            <Row
              label="One response per device"
              value={form.oneResponsePerDevice ? "Yes" : "No"}
            />
            <Row
              label="Max responses"
              value={form.maxResponses === null ? "Unlimited" : String(form.maxResponses)}
            />
            <Row
              label="Closes at"
              value={form.closesAt ? new Date(form.closesAt).toLocaleString() : "Never"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
