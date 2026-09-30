"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { CheckIcon, CopyIcon, DownloadIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { useUpdateFormSlug } from "~/hooks/api/form";
import { publicFormUrl } from "~/lib/share-url";
import { useBuilderStore } from "~/stores/builder-store";

/**
 * Sharing: the link, a QR code for it, and whether the form is actually live.
 *
 * The QR is generated in the browser with `qrcode` — no server round trip, and nothing
 * about the link leaves the machine beyond the request that fetched it. It is rendered as
 * inline SVG so it scales, and can be downloaded as a PNG for a poster.
 */
export function ShareWorkspace() {
  const { formId } = useParams<{ formId: string }>();
  const definition = useBuilderStore((state) => state.definition);
  const { updateFormSlugAsync, status: slugStatus, isError, error } = useUpdateFormSlug();

  const [slug, setSlug] = useState(definition?.slug ?? "");
  const [copied, setCopied] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);

  const shareUrl = definition ? publicFormUrl(definition.slug) : "";

  useEffect(() => {
    if (definition) setSlug(definition.slug);
  }, [definition?.slug, definition]);

  useEffect(() => {
    if (!shareUrl) {
      setSvg(null);
      return;
    }

    let cancelled = false;
    void QRCode.toString(shareUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#0e0f0c", light: "#ffffff" },
    })
      .then((result) => {
        if (!cancelled) setSvg(result);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });

    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  if (!definition) return null;

  const isLive = definition.status === "PUBLISHED";
  const slugChanged = slug !== definition.slug;

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPng = async () => {
    const url = await QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: { dark: "#0e0f0c", light: "#ffffff" },
    });
    const link = document.createElement("a");
    link.href = url;
    link.download = `${definition.slug}.png`;
    link.click();
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Public link</h2>

          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl} aria-label="Public form link" className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy link"
              onClick={copy}
              disabled={!shareUrl}
            >
              {copied ? <CheckIcon className="text-positive" /> : <CopyIcon />}
            </Button>
          </div>

          {!isLive && (
            <p className="text-sm font-medium text-warning-foreground">
              This form is {definition.status === "DRAFT" ? "a draft" : "closed"}, so the link
              will not accept responses yet.
            </p>
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Address</h2>
          <Field>
            <FieldLabel htmlFor="share-slug">Form address</FieldLabel>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground shrink-0 font-mono text-sm">/f/</span>
              <Input
                id="share-slug"
                value={slug}
                onChange={(event) =>
                  setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                className="font-mono text-sm"
              />
            </div>
            <FieldDescription>
              Changing this breaks any link, QR code or printed card already in circulation.
            </FieldDescription>
          </Field>

          <div className="flex items-center gap-2">
            <Button
              disabled={!slugChanged || slugStatus === "pending" || slug.length < 1}
              onClick={() => updateFormSlugAsync({ formId, slug })}
            >
              {slugStatus === "pending" ? "Saving…" : "Update address"}
            </Button>
            {slugChanged && (
              <Button variant="ghost" onClick={() => setSlug(definition.slug)}>
                Undo
              </Button>
            )}
          </div>

          {isError && (
            <p role="alert" className="text-destructive text-sm">
              {error?.message ?? "That address could not be used."}
            </p>
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">QR code</h2>
          <div className="flex flex-wrap items-start gap-6">
            <div className="rounded-xl bg-card p-3 ring-1 ring-border">
              {svg ? (
                <div
                  role="img"
                  aria-label={`QR code for ${shareUrl}`}
                  className="size-40"
                  // The SVG is generated locally from a URL we already have; there is no
                  // user content interpolated into it.
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <div className="text-muted-foreground flex size-40 items-center justify-center text-center text-xs">
                  Generating…
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={downloadPng} disabled={!shareUrl}>
                <DownloadIcon className="size-4" />
                Download PNG
              </Button>
              <p className="text-muted-foreground max-w-56 text-xs">
                Generated in your browser. Print it on a poster and the camera on a phone
                opens the form.
              </p>
            </div>
          </div>

          {svg === null && shareUrl && (
            <p className="text-destructive flex items-center gap-1.5 text-sm">
              <TriangleAlertIcon className="size-4" />
              The QR code could not be generated. The link above still works.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
