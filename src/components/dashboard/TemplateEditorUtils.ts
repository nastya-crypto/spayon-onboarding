/**
 * Pure utility functions for TemplateEditor — exported separately so they
 * can be tested in the Jest node environment without rendering React.
 */

export type FieldType = "TEXT" | "EMAIL" | "URL" | "NUMBER" | "TEXTAREA" | "FILE" | "CHECKBOX";

export type FieldDraft = {
  _id: string;
  label: string;
  type: FieldType;
  placeholder: string;
  required: boolean;
  isProtected?: boolean;
};

export type StepDraft = {
  _id: string;
  title: string;
  fields: FieldDraft[];
};

export type SavePayload = {
  name: string;
  steps: Array<{
    title: string;
    fields: Array<{
      label: string;
      type: FieldType;
      placeholder?: string;
      required: boolean;
    }>;
  }>;
};

const VALIDATION_ERROR =
  "A template must have at least one step, and each step must have at least one field.";

/**
 * Returns null if the template is valid, or an error message string if not.
 */
export function validateTemplate(name: string, steps: StepDraft[]): string | null {
  if (steps.length === 0) return VALIDATION_ERROR;
  for (const step of steps) {
    if (step.fields.length === 0) return VALIDATION_ERROR;
  }
  return null;
}

/**
 * Returns true if the field should have a Delete button rendered.
 */
export function hasDeleteButton(field: FieldDraft): boolean {
  return field.isProtected !== true;
}

/**
 * Moves item at `index` up or down in the array.
 * Returns a new array. No-ops at boundaries.
 */
export function reorderItems<T>(items: T[], index: number, direction: "up" | "down"): T[] {
  const copy = [...items];
  if (direction === "up" && index > 0) {
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
  } else if (direction === "down" && index < items.length - 1) {
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
  }
  return copy;
}

/**
 * Strips draft-only properties (_id, isProtected) and returns the API payload.
 */
export function buildSavePayload(name: string, steps: StepDraft[]): SavePayload {
  return {
    name,
    steps: steps.map((step) => ({
      title: step.title,
      fields: step.fields.map(({ label, type, placeholder, required }) => ({
        label,
        type,
        placeholder: placeholder || undefined,
        required,
      })),
    })),
  };
}
