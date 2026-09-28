"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";

import { FormPreview } from "~/components/form/form-preview";
import { BuilderChrome } from "~/components/builder/builder-chrome";
import { Button } from "~/components/ui/button";
import { useBuilderStore } from "~/stores/builder-store";
import { cn } from "~/lib/utils";

type PreviewWidth = "desktop" | "mobile";

/**
 * Live preview, mounted from the same `FormRenderer` the public route uses.
 *
 * It reads the store rather than refetching, so an edit appears here as it is made — which
 * is the point: a preview that only refreshes on save is a screenshot, not a preview.
 * Because it is the same component tree, "what I see" cannot drift from "what they get".
 *
 * The width toggle is local state, deliberately. It is a viewing preference rather than a
 * property of the form, so putting it on the definition would have the builder try to save
 * it — and the service would reject a field it does not know.
 */
export function PreviewWorkspace() {
  const { formId } = useParams<{ formId: string }>();
  const definition = useBuilderStore((state) => state.definition);
  const [width, setWidth] = useState<PreviewWidth>("desktop");

  const options = [
    { key: "desktop", label: "Desktop", icon: MonitorIcon },
    { key: "mobile", label: "Phone", icon: SmartphoneIcon },
  ] as const;

  return (
    <BuilderChrome formId={formId}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b bg-card px-4 py-2 sm:px-6">
          <div
            role="group"
            aria-label="Preview width"
            className="flex w-fit gap-1 rounded-lg bg-muted p-1"
          >
            {options.map((option) => {
              const Icon = option.icon;
              const selected = width === option.key;
              return (
                <Button
                  key={option.key}
                  size="sm"
                  variant="ghost"
                  aria-pressed={selected}
                  className={cn("gap-1.5", selected && "bg-card shadow-xs")}
                  onClick={() => setWidth(option.key)}
                >
                  <Icon className="size-3.5" />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {definition && <FormPreview formId={definition.id} definition={definition} deviceWidth={width} />}
        </div>
      </div>
    </BuilderChrome>
  );
}
