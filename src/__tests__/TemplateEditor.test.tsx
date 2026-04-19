/**
 * TemplateEditor logic-only tests (Jest node environment, no @testing-library/react)
 * Tests exercise the pure utility functions extracted from TemplateEditor.
 */

import {
  validateTemplate,
  reorderItems,
  buildSavePayload,
  hasDeleteButton,
  type StepDraft,
  type FieldDraft,
} from "@/components/dashboard/TemplateEditorUtils";

// --- save_blocked_no_steps ---
describe("save_blocked_no_steps", () => {
  test("validateTemplate returns error when there are no steps", () => {
    const result = validateTemplate("My Template", []);
    expect(result).toBe(
      "A template must have at least one step, and each step must have at least one field."
    );
  });
});

// --- save_blocked_empty_step ---
describe("save_blocked_empty_step", () => {
  test("validateTemplate returns error when a step has 0 fields", () => {
    const steps: StepDraft[] = [
      { _id: "s1", title: "Step 1", fields: [] },
    ];
    const result = validateTemplate("My Template", steps);
    expect(result).toBe(
      "A template must have at least one step, and each step must have at least one field."
    );
  });
});

// --- save_allowed_valid ---
describe("save_allowed_valid", () => {
  test("validateTemplate returns null when 1 step + 1 field present", () => {
    const steps: StepDraft[] = [
      {
        _id: "s1",
        title: "Step 1",
        fields: [
          {
            _id: "f1",
            label: "Company Name",
            type: "TEXT",
            placeholder: "",
            required: true,
          },
        ],
      },
    ];
    const result = validateTemplate("My Template", steps);
    expect(result).toBeNull();
  });
});

// --- protected_field_no_delete ---
describe("protected_field_no_delete", () => {
  test("hasDeleteButton returns false for isProtected field", () => {
    const field: FieldDraft = {
      _id: "f1",
      label: "Company Name",
      type: "TEXT",
      placeholder: "",
      required: true,
      isProtected: true,
    };
    expect(hasDeleteButton(field)).toBe(false);
  });

  test("hasDeleteButton returns true for a normal field", () => {
    const field: FieldDraft = {
      _id: "f2",
      label: "Email",
      type: "EMAIL",
      placeholder: "",
      required: false,
    };
    expect(hasDeleteButton(field)).toBe(true);
  });
});

// --- reorder_steps ---
describe("reorder_steps", () => {
  test("reorderItems moves first item down (swap with second)", () => {
    const steps: StepDraft[] = [
      { _id: "s1", title: "First", fields: [] },
      { _id: "s2", title: "Second", fields: [] },
      { _id: "s3", title: "Third", fields: [] },
    ];
    const result = reorderItems(steps, 0, "down");
    expect(result[0]._id).toBe("s2");
    expect(result[1]._id).toBe("s1");
    expect(result[2]._id).toBe("s3");
  });

  test("reorderItems moves last item up (swap with second-to-last)", () => {
    const steps: StepDraft[] = [
      { _id: "s1", title: "First", fields: [] },
      { _id: "s2", title: "Second", fields: [] },
    ];
    const result = reorderItems(steps, 1, "up");
    expect(result[0]._id).toBe("s2");
    expect(result[1]._id).toBe("s1");
  });

  test("reorderItems no-ops when moving first item up", () => {
    const steps: StepDraft[] = [
      { _id: "s1", title: "First", fields: [] },
      { _id: "s2", title: "Second", fields: [] },
    ];
    const result = reorderItems(steps, 0, "up");
    expect(result[0]._id).toBe("s1");
    expect(result[1]._id).toBe("s2");
  });

  test("reorderItems no-ops when moving last item down", () => {
    const steps: StepDraft[] = [
      { _id: "s1", title: "First", fields: [] },
      { _id: "s2", title: "Second", fields: [] },
    ];
    const result = reorderItems(steps, 1, "down");
    expect(result[0]._id).toBe("s1");
    expect(result[1]._id).toBe("s2");
  });
});

// --- buildSavePayload strips _id and isProtected ---
describe("buildSavePayload", () => {
  test("strips _id from steps and fields", () => {
    const steps: StepDraft[] = [
      {
        _id: "s1",
        title: "Step 1",
        fields: [
          {
            _id: "f1",
            label: "Name",
            type: "TEXT",
            placeholder: "Enter name",
            required: true,
            isProtected: true,
          },
        ],
      },
    ];
    const payload = buildSavePayload("My Template", steps);
    expect(payload.name).toBe("My Template");
    expect(payload.steps[0]).not.toHaveProperty("_id");
    expect(payload.steps[0].fields[0]).not.toHaveProperty("_id");
    expect(payload.steps[0].fields[0]).not.toHaveProperty("isProtected");
  });
});
