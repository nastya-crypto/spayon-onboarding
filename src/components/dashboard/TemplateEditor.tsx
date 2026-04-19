"use client";

import { useState } from "react";
import {
  validateTemplate,
  hasDeleteButton,
  reorderItems,
  buildSavePayload,
  type FieldType,
  type FieldDraft,
  type StepDraft,
  type SavePayload,
} from "./TemplateEditorUtils";

export type { FieldType, FieldDraft, StepDraft };

type TemplateEditorProps = {
  initialData?: {
    name: string;
    steps: Array<{
      id?: string;
      title: string;
      fields: Array<{
        id?: string;
        label: string;
        type: FieldType;
        placeholder?: string | null;
        required: boolean;
        isProtected?: boolean;
      }>;
    }>;
  };
  onSave: (data: SavePayload) => void | Promise<void>;
  saving?: boolean;
};

const FIELD_TYPES: FieldType[] = ["TEXT", "EMAIL", "URL", "NUMBER", "TEXTAREA", "FILE", "CHECKBOX"];

function makeField(overrides?: Partial<FieldDraft>): FieldDraft {
  return {
    _id: crypto.randomUUID(),
    label: "",
    type: "TEXT",
    placeholder: "",
    required: false,
    ...overrides,
  };
}

function makeStep(overrides?: Partial<StepDraft>): StepDraft {
  return {
    _id: crypto.randomUUID(),
    title: "",
    fields: [],
    ...overrides,
  };
}

function initSteps(
  initialData: TemplateEditorProps["initialData"]
): StepDraft[] {
  if (!initialData) return [];
  return initialData.steps.map((s) => ({
    _id: s.id ?? crypto.randomUUID(),
    title: s.title,
    fields: s.fields.map((f) => ({
      _id: f.id ?? crypto.randomUUID(),
      label: f.label,
      type: f.type,
      placeholder: f.placeholder ?? "",
      required: f.required,
      isProtected: f.isProtected,
    })),
  }));
}

export function TemplateEditor({ initialData, onSave, saving: externalSaving }: TemplateEditorProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(() => initSteps(initialData));
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isSaving = saving || externalSaving;
  const validError = validateTemplate(name, steps);

  // ---- Step operations ----
  function addStep() {
    setSteps((prev) => [...prev, makeStep()]);
  }

  function deleteStep(stepIdx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== stepIdx));
  }

  function moveStep(stepIdx: number, direction: "up" | "down") {
    setSteps((prev) => reorderItems(prev, stepIdx, direction));
  }

  function updateStepTitle(stepIdx: number, title: string) {
    setSteps((prev) =>
      prev.map((s, i) => (i === stepIdx ? { ...s, title } : s))
    );
  }

  // ---- Field operations ----
  function addField(stepIdx: number) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx ? { ...s, fields: [...s.fields, makeField()] } : s
      )
    );
  }

  function deleteField(stepIdx: number, fieldIdx: number) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx
          ? { ...s, fields: s.fields.filter((_, fi) => fi !== fieldIdx) }
          : s
      )
    );
  }

  function moveField(stepIdx: number, fieldIdx: number, direction: "up" | "down") {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx
          ? { ...s, fields: reorderItems(s.fields, fieldIdx, direction) }
          : s
      )
    );
  }

  function updateField(stepIdx: number, fieldIdx: number, patch: Partial<FieldDraft>) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx
          ? {
              ...s,
              fields: s.fields.map((f, fi) =>
                fi === fieldIdx ? { ...f, ...patch } : f
              ),
            }
          : s
      )
    );
  }

  // ---- Save ----
  async function handleSave() {
    const err = validateTemplate(name, steps);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setSaving(true);
    try {
      await onSave(buildSavePayload(name, steps));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Template Name */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Template Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          placeholder="e.g. Merchant Onboarding"
          className="w-full px-4 py-2 text-sm text-gray-900 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, stepIdx) => (
          <div key={step._id} className="bg-white rounded-xl shadow-sm p-6">
            {/* Step header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide w-16 shrink-0">
                Step {stepIdx + 1}
              </span>
              <input
                type="text"
                value={step.title}
                onChange={(e) => updateStepTitle(stepIdx, e.target.value)}
                placeholder="Step title"
                className="flex-1 px-3 py-1.5 text-sm text-gray-900 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveStep(stepIdx, "up")}
                  disabled={stepIdx === 0}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(stepIdx, "down")}
                  disabled={stepIdx === steps.length - 1}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => deleteStep(stepIdx)}
                  className="p-1.5 rounded text-red-500 hover:text-red-700"
                  title="Delete step"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-2 mb-4">
              {step.fields.map((field, fieldIdx) => (
                <div
                  key={field._id}
                  className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  {/* Type */}
                  <select
                    value={field.type}
                    onChange={(e) =>
                      updateField(stepIdx, fieldIdx, { type: e.target.value as FieldType })
                    }
                    className="px-2 py-1.5 text-xs text-gray-700 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  {/* Label */}
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateField(stepIdx, fieldIdx, { label: e.target.value })}
                    placeholder="Label"
                    className="flex-1 min-w-[120px] px-2 py-1.5 text-xs text-gray-900 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Placeholder */}
                  <input
                    type="text"
                    value={field.placeholder}
                    onChange={(e) =>
                      updateField(stepIdx, fieldIdx, { placeholder: e.target.value })
                    }
                    placeholder="Placeholder"
                    className="flex-1 min-w-[120px] px-2 py-1.5 text-xs text-gray-700 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Required toggle */}
                  <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        updateField(stepIdx, fieldIdx, { required: e.target.checked })
                      }
                      className="rounded border-gray-300"
                    />
                    Required
                  </label>

                  {/* Reorder + delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveField(stepIdx, fieldIdx, "up")}
                      disabled={fieldIdx === 0}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(stepIdx, fieldIdx, "down")}
                      disabled={fieldIdx === step.fields.length - 1}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                      title="Move down"
                    >
                      ↓
                    </button>
                    {hasDeleteButton(field) && (
                      <button
                        type="button"
                        onClick={() => deleteField(stepIdx, fieldIdx)}
                        className="p-1 rounded text-red-500 hover:text-red-700 text-xs"
                        title="Delete field"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Field button */}
            <button
              type="button"
              onClick={() => addField(stepIdx)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add Field
            </button>
          </div>
        ))}
      </div>

      {/* Add Step */}
      <button
        type="button"
        onClick={addStep}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        + Add Step
      </button>

      {/* Validation error */}
      {validationError && (
        <p className="text-sm text-red-600 font-medium">{validationError}</p>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || validError !== null || !name.trim()}
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}
