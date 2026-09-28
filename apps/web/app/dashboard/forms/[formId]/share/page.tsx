"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckIcon, CopyIcon } from "lucide-react";

import { FormTabs } from "~/components/form-tabs";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useGetFormSettings } from "~/hooks/api/form";

/**
 * Share link and publish state. The slug editor and QR code are Phase 5; the copyable
 * link and the publish gate are here because they are the point of the page.
 */
export default function FormSharePage() {
  const { formId } = useParams<{ formId: string }>();
  const { form, isLoading } = useGetFormSettings(formId);
  const [copied, setCopied] = useState(false);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shareUrl = form ? `${appUrl}/f/${form.slug}` : "";

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col">
      <FormTabs formId={formId} />

      <div className="mx-auto w-full max-w-2xl p-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Share</h1>
          {form && <Badge variant="secondary">{form.status}</Badge>}
        </div>

        {isLoading && <Skeleton className="mt-6 h-9 w-full" />}

        {form && (
          <>
            <div className="mt-6 flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl}
                aria-label="Public form link"
                className="font-mono text-xs"
              />
              <Button onClick={copy} variant="outline" size="icon" aria-label="Copy link">
                {copied ? (
                  <CheckIcon className="text-primary" />
                ) : (
                  <CopyIcon />
                )}
              </Button>
            </div>

            {form.status !== "PUBLISHED" && (
              <p className="text-muted-foreground mt-3 text-sm">
                This form is {form.status.toLowerCase()}, so the link will not accept
                responses yet. Publish it from the builder once it is fillable.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
