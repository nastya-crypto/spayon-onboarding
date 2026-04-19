import { z } from "zod";

type FieldType =
  | "TEXT"
  | "EMAIL"
  | "URL"
  | "NUMBER"
  | "TEXTAREA"
  | "FILE"
  | "CHECKBOX";

type FieldInput = {
  fieldKey: string;
  type: FieldType;
  required: boolean;
};

/**
 * Builds a Zod validation schema from an array of FormField records.
 * Used by the public submit endpoint (Task 3) to validate form submissions.
 */
export function buildZodSchema(fields: FieldInput[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case "TEXT":
      case "TEXTAREA":
        fieldSchema = field.required
          ? z.string().min(1).max(10000)
          : z.string().max(10000);
        break;
      case "EMAIL":
        fieldSchema = z.string().email().max(255);
        break;
      case "URL":
        fieldSchema = z.string().url().max(2048);
        break;
      case "NUMBER":
        fieldSchema = z.number().finite();
        break;
      case "CHECKBOX":
        fieldSchema = z.boolean();
        break;
      case "FILE":
        // Value stored as JSON string: { url, mimeType, size }
        fieldSchema = z.string();
        break;
      default:
        fieldSchema = z.string();
    }

    if (!field.required) {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.fieldKey] = fieldSchema;
  }

  return z.object(shape);
}
