"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  InboxIcon,
  LinkIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { publicFormUrl } from "~/lib/share-url";

export interface OverviewFormItem {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  views: number;
  completions: number;
  createdAt?: Date | string | null;
}

export function TopFormsCard({
  forms,
}: {
  forms: OverviewFormItem[];
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const topForms = forms.slice(0, 4);

  const copyLink = async (form: OverviewFormItem) => {
    const url = publicFormUrl(form.slug);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);

      toast.success(
        form.status === "DRAFT"
          ? "Link copied — draft forms require publishing before accepting responses."
          : "Public form link copied",
      );
    } catch {
      toast.error("Could not copy link", { description: url });
    }
  };

  return (
    <Card className="flex flex-col justify-between rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SparklesIcon className="text-primary size-4" />
            <CardTitle className="text-base font-semibold">Top Performing Forms</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            Ranked by completions
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Your highest-converting active forms in the selected period.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 pt-1">
        {topForms.length === 0 ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-xs">
            <FileTextIcon className="size-8 opacity-40" />
            <p>No form activity recorded yet.</p>
          </div>
        ) : (
          topForms.map((form) => {
            const rate = form.views > 0 ? Math.round((form.completions / form.views) * 100) : 0;
            const isCopied = copiedId === form.id;
            const isLive = form.status === "PUBLISHED";

            return (
              <div
                key={form.id}
                className="group/item flex flex-col gap-2 rounded-lg border bg-card/60 p-3 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/forms/${form.id}/build`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {form.title}
                      </Link>
                      {isLive ? (
                        <span className="bg-positive-subtle text-positive-foreground inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                          <span className="bg-positive size-1 rounded-full" />
                          Live
                        </span>
                      ) : (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          Draft
                        </Badge>
                      )}
                    </div>

                    <div className="text-muted-foreground mt-1 flex items-center gap-3 text-xs">
                      <span>
                        <strong className="text-foreground font-semibold">{form.completions}</strong>{" "}
                        responses
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-foreground font-semibold">{form.views}</strong> views
                      </span>
                      <span>·</span>
                      <span>
                        <strong className="text-foreground font-semibold">{rate}%</strong> rate
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1 opacity-80 group-hover/item:opacity-100">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Copy link for ${form.title}`}
                      onClick={() => void copyLink(form)}
                      className="size-7"
                    >
                      {isCopied ? (
                        <CheckIcon className="text-positive size-3.5" />
                      ) : (
                        <LinkIcon className="size-3.5" />
                      )}
                    </Button>
                    <Button asChild size="icon-sm" variant="ghost" className="size-7" title="View Responses">
                      <Link href={`/responses?form=${form.id}`}>
                        <InboxIcon className="size-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="icon-sm" variant="ghost" className="size-7" title="Open Builder">
                      <Link href={`/forms/${form.id}/build`}>
                        <ExternalLinkIcon className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <Progress value={rate} className="h-1 bg-muted" />
              </div>
            );
          })
        )}
      </CardContent>

      <CardFooter className="border-t pt-3 pb-3">
        <Button asChild variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground">
          <Link href="/forms">
            <span>Manage all {forms.length} forms</span>
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
