"use client";

import { useParams } from "next/navigation";

import { BuilderChrome } from "~/components/builder/builder-chrome";
import { ShareWorkspace } from "~/components/builder/share-workspace";

export default function FormSharePage() {
  const { formId } = useParams<{ formId: string }>();

  return (
    <BuilderChrome formId={formId}>
      <ShareWorkspace />
    </BuilderChrome>
  );
}
