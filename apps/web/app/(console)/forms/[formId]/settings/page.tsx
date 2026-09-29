"use client";

import { SettingsWorkspace } from "~/components/builder/settings-workspace";
import { BuilderChrome } from "~/components/builder/builder-chrome";
import { useParams } from "next/navigation";

/**
 * Settings, inside the builder chrome so the store stays hydrated and the save indicator
 * and publish action stay in view while settings are edited.
 */
export default function FormSettingsPage() {
  const { formId } = useParams<{ formId: string }>();

  return (
    <BuilderChrome formId={formId}>
      <SettingsWorkspace />
    </BuilderChrome>
  );
}
