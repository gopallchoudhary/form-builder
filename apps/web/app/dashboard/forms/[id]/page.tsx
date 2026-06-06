"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import {
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
  ArrowLeftIcon,
  GripVerticalIcon,
  TypeIcon,
  HashIcon,
  MailIcon,
  ToggleLeftIcon,
  LockIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  useCreateField,
  useUpdateField,
  useDeleteField,
  useGetField,
} from "~/hooks/api/form";

// ── Types ──────────────────────────────────────────────────────────────────────

type FieldType = "TEXT" | "NUMBER" | "EMAIL" | "YES_NO" | "PASSWORD";

interface FieldSnapshot {
  id: string;
  label: string;
  labelKey: string;
  type: FieldType;
  isRequired: boolean;
  index: string | null;
  placeholder?: string | null;
  description?: string | null;
}

type AddFieldFormValues = {
  label: string;
  placeholder: string;
  description: string;
  type: FieldType;
  isRequired: boolean;
};

type EditFieldFormValues = {
  label: string;
  placeholder: string;
  description: string;
  type: FieldType;
  isRequired: boolean;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const FIELD_TYPE_META: {
  value: FieldType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "TEXT",     label: "Text",     icon: <TypeIcon className="size-3.5" /> },
  { value: "NUMBER",   label: "Number",   icon: <HashIcon className="size-3.5" /> },
  { value: "EMAIL",    label: "Email",    icon: <MailIcon className="size-3.5" /> },
  { value: "YES_NO",   label: "Yes / No", icon: <ToggleLeftIcon className="size-3.5" /> },
  { value: "PASSWORD", label: "Password", icon: <LockIcon className="size-3.5" /> },
];

function getTypeMeta(type: FieldType) {
  return FIELD_TYPE_META.find((m) => m.value === type) ?? FIELD_TYPE_META[0]!;
}

/** Returns the next fractional index after all existing fields */
function nextIndex(fields: FieldSnapshot[]): string {
  if (fields.length === 0) return "1.00";
  const max = Math.max(...fields.map((f) => parseFloat(f.index ?? "0")));
  return (max + 1).toFixed(2);
}

// ── Field Card ─────────────────────────────────────────────────────────────────

function FieldCard({
  field,
  isSelected,
  isDeleting,
  onSelect,
  onDelete,
}: {
  field: FieldSnapshot;
  isSelected: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const meta = getTypeMeta(field.type);

  return (
    <div
      id={`field-card-${field.id}`}
      onClick={onSelect}
      className={[
        "group flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:shadow-sm",
      ].join(" ")}
    >
      <GripVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{field.label}</span>
          {field.isRequired && (
            <span className="text-xs font-semibold text-destructive">*</span>
          )}
          <Badge variant="secondary" className="gap-1 py-0 text-xs">
            {meta.icon}
            {meta.label}
          </Badge>
        </div>
        {field.placeholder && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {field.placeholder}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ChevronRightIcon
          className={[
            "size-4 text-muted-foreground transition-transform",
            isSelected ? "rotate-90 text-primary" : "",
          ].join(" ")}
        />
        <Button
          id={`delete-field-${field.id}`}
          size="icon-sm"
          variant="ghost"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
        >
          {isDeleting ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <Trash2Icon className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Add Field Panel ────────────────────────────────────────────────────────────

function AddFieldPanel({
  formId,
  fields,
  onFieldCreated,
}: {
  formId: string;
  fields: FieldSnapshot[];
  onFieldCreated: (field: FieldSnapshot) => void;
}) {
  const { createFieldAsync, status } = useCreateField(formId);
  const isPending = status === "pending";

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AddFieldFormValues>({
    defaultValues: {
      label: "",
      placeholder: "",
      description: "",
      type: "TEXT",
      isRequired: false,
    },
  });

  const onSubmit: SubmitHandler<AddFieldFormValues> = async (data) => {
    const index = nextIndex(fields);
    const { id, labelKey } = await createFieldAsync({
      formId,
      label: data.label,
      placeholder: data.placeholder || undefined,
      description: data.description || undefined,
      type: data.type,
      isRequired: data.isRequired,
      index,
    });

    onFieldCreated({
      id,
      labelKey,
      label: data.label,
      type: data.type,
      isRequired: data.isRequired,
      index,
      placeholder: data.placeholder || null,
      description: data.description || null,
    });

    reset();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Add Field</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Configure and add a new field to this form.
        </p>
      </div>

      <form
        id="add-field-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3"
      >
        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-label">
            Label <span className="text-destructive">*</span>
          </Label>
          <Input
            id="add-label"
            placeholder="e.g. Full Name"
            disabled={isPending}
            {...register("label", { required: "Label is required" })}
          />
          {errors.label && (
            <p className="text-xs text-destructive">{errors.label.message}</p>
          )}
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-type">Type</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isPending}
              >
                <SelectTrigger id="add-type" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_META.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        {t.icon}
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Placeholder */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-placeholder">
            Placeholder{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="add-placeholder"
            placeholder="e.g. Enter your full name"
            disabled={isPending}
            {...register("placeholder")}
          />
        </div>

        {/* Helper text */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="add-description">
            Helper Text{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Textarea
            id="add-description"
            placeholder="Shown below the field"
            disabled={isPending}
            className="min-h-14 resize-none"
            {...register("description")}
          />
        </div>

        {/* Required toggle */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <Label htmlFor="add-required" className="cursor-pointer">
            Required
          </Label>
          <Controller
            name="isRequired"
            control={control}
            render={({ field }) => (
              <Switch
                id="add-required"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
        </div>

        <Button
          id="add-field-submit"
          type="submit"
          disabled={isPending}
          className="w-full gap-2"
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Adding…
            </>
          ) : (
            <>
              <PlusIcon className="size-4" /> Add Field
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

// ── Edit Field Panel ───────────────────────────────────────────────────────────

function EditFieldPanel({
  fieldId,
  onClose,
  onSaved,
}: {
  fieldId: string;
  onClose: () => void;
  onSaved: (updated: Partial<FieldSnapshot>) => void;
}) {
  const { field, isLoading } = useGetField(fieldId);
  const { updateFieldAsync, status } = useUpdateField();
  const isUpdating = status === "pending";

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<EditFieldFormValues>();

  useEffect(() => {
    if (field) {
      reset({
        label: field.label,
        placeholder: field.placeholder ?? "",
        description: field.description ?? "",
        type: field.type as FieldType,
        isRequired: field.isRequired,
      });
    }
  }, [field, reset]);

  const onSubmit: SubmitHandler<EditFieldFormValues> = async (data) => {
    await updateFieldAsync({
      fieldId,
      label: data.label,
      placeholder: data.placeholder || undefined,
      description: data.description || undefined,
      type: data.type,
      isRequired: data.isRequired,
    });
    onSaved({
      label: data.label,
      type: data.type,
      isRequired: data.isRequired,
      placeholder: data.placeholder || null,
      description: data.description || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Panel header */}
      <div className="flex items-center gap-2">
        <Button
          id="close-edit-panel"
          size="icon-sm"
          variant="ghost"
          onClick={onClose}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Edit Field</h3>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {field?.labelKey}
          </p>
        </div>
      </div>

      <form
        id="edit-field-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3"
      >
        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-label">
            Label <span className="text-destructive">*</span>
          </Label>
          <Input
            id="edit-label"
            disabled={isUpdating}
            {...register("label", { required: "Label is required" })}
          />
          {errors.label && (
            <p className="text-xs text-destructive">{errors.label.message}</p>
          )}
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-type">Type</Label>
          <Controller
            name="type"
            control={control}
            render={({ field: f }) => (
              <Select
                value={f.value}
                onValueChange={f.onChange}
                disabled={isUpdating}
              >
                <SelectTrigger id="edit-type" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_META.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        {t.icon}
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Placeholder */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-placeholder">
            Placeholder{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="edit-placeholder"
            disabled={isUpdating}
            {...register("placeholder")}
          />
        </div>

        {/* Helper text */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-description">
            Helper Text{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Textarea
            id="edit-description"
            disabled={isUpdating}
            className="min-h-14 resize-none"
            {...register("description")}
          />
        </div>

        {/* Required toggle */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <Label htmlFor="edit-required" className="cursor-pointer">
            Required
          </Label>
          <Controller
            name="isRequired"
            control={control}
            render={({ field: f }) => (
              <Switch
                id="edit-required"
                checked={f.value}
                onCheckedChange={f.onChange}
                disabled={isUpdating}
              />
            )}
          />
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            id="save-field-btn"
            type="submit"
            disabled={isUpdating}
            className="flex-1 gap-2"
          >
            {isUpdating ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── Form Builder Page ──────────────────────────────────────────────────────────

const FormBuilderPage = () => {
  const { id: formId } = useParams<{ id: string }>();
  const router = useRouter();

  // Local field list — seeded from createField responses (no listFields query yet)
  const [fields, setFields] = useState<FieldSnapshot[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  const { deleteFieldAsync } = useDeleteField();

  const orderedFields = [...fields].sort(
    (a, b) => parseFloat(a.index ?? "0") - parseFloat(b.index ?? "0")
  );

  const handleFieldCreated = (field: FieldSnapshot) => {
    setFields((prev) => [...prev, field]);
  };

  const handleDelete = async (fieldId: string) => {
    setDeletingFieldId(fieldId);
    try {
      await deleteFieldAsync({ fieldId });
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
      if (selectedFieldId === fieldId) setSelectedFieldId(null);
    } finally {
      setDeletingFieldId(null);
    }
  };

  const handleSaved = (fieldId: string, updated: Partial<FieldSnapshot>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...updated } : f))
    );
    setSelectedFieldId(null);
  };

  return (
    <div className="flex h-full flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 border-b px-6 py-3">
        <Button
          id="back-to-forms"
          size="icon-sm"
          variant="ghost"
          onClick={() => router.push("/dashboard/forms")}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Form Builder</p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {formId}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {orderedFields.length}{" "}
          {orderedFields.length === 1 ? "field" : "fields"}
        </Badge>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
          {orderedFields.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <PlusIcon className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No fields yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add your first field using the panel on the right
                </p>
              </div>
            </div>
          ) : (
            orderedFields.map((field) => (
              <FieldCard
                key={field.id}
                field={field}
                isSelected={selectedFieldId === field.id}
                isDeleting={deletingFieldId === field.id}
                onSelect={() =>
                  setSelectedFieldId((prev) =>
                    prev === field.id ? null : field.id
                  )
                }
                onDelete={() => handleDelete(field.id)}
              />
            ))
          )}
        </div>

        {/* Right panel */}
        <div className="w-80 shrink-0 overflow-y-auto border-l bg-muted/30 p-5">
          {selectedFieldId ? (
            <EditFieldPanel
              key={selectedFieldId}
              fieldId={selectedFieldId}
              onClose={() => setSelectedFieldId(null)}
              onSaved={(updated) => handleSaved(selectedFieldId, updated)}
            />
          ) : (
            <AddFieldPanel
              formId={formId}
              fields={fields}
              onFieldCreated={handleFieldCreated}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FormBuilderPage;