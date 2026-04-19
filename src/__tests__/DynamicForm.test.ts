// Tests for DynamicForm validation logic and localStorage draft utilities.
// Run in node environment — no DOM rendering needed since all tested logic is pure.

import { validateStep, saveDraft, loadDraft, clearDraft } from "@/app/(onboarding)/onboarding/[templateId]/DynamicForm";
import type { PublicField } from "@/app/(onboarding)/onboarding/[templateId]/DynamicForm";

// ── localStorage mock ────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => store[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: jest.fn((key: string) => { delete store[key]; }),
  clear: jest.fn(() => { Object.keys(store).forEach(k => { delete store[k]; }); }),
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

const T_EN = {
  errRequired: "Required field",
  errEmail: "Enter a valid email",
  errUrl: "Enter a valid URL (http:// or https://)",
  errNumber: "Enter a valid number",
};

// ── Validation tests ─────────────────────────────────────────────────────────

describe("validateStep — EMAIL field", () => {
  const field: PublicField = { id: "f-1", label: "Email", type: "EMAIL", required: false, placeholder: null, order: 0 };

  it("rejects non-email value", () => {
    const errors = validateStep([field], { "f-1": "not-an-email" }, {}, T_EN);
    expect(errors["f-1"]).toBe(T_EN.errEmail);
  });

  it("accepts valid email", () => {
    const errors = validateStep([field], { "f-1": "user@example.com" }, {}, T_EN);
    expect(errors["f-1"]).toBeUndefined();
  });
});

describe("validateStep — URL field", () => {
  const field: PublicField = { id: "f-2", label: "Website", type: "URL", required: false, placeholder: null, order: 0 };

  it("rejects non-URL value", () => {
    const errors = validateStep([field], { "f-2": "not-a-url" }, {}, T_EN);
    expect(errors["f-2"]).toBe(T_EN.errUrl);
  });

  it("accepts valid https URL", () => {
    const errors = validateStep([field], { "f-2": "https://example.com" }, {}, T_EN);
    expect(errors["f-2"]).toBeUndefined();
  });
});

describe("validateStep — required TEXT field", () => {
  const field: PublicField = { id: "f-3", label: "Name", type: "TEXT", required: true, placeholder: null, order: 0 };

  it("rejects empty string for required field", () => {
    const errors = validateStep([field], { "f-3": "" }, {}, T_EN);
    expect(errors["f-3"]).toBe(T_EN.errRequired);
  });

  it("accepts non-empty value", () => {
    const errors = validateStep([field], { "f-3": "Acme Corp" }, {}, T_EN);
    expect(errors["f-3"]).toBeUndefined();
  });
});

describe("validateStep — optional TEXT field", () => {
  const field: PublicField = { id: "f-4", label: "Notes", type: "TEXT", required: false, placeholder: null, order: 0 };

  it("passes with empty value", () => {
    const errors = validateStep([field], { "f-4": "" }, {}, T_EN);
    expect(errors["f-4"]).toBeUndefined();
  });
});

// ── localStorage draft tests ─────────────────────────────────────────────────

describe("localStorage draft", () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    // Re-seed clear mock since it was cleared
    localStorageMock.clear.mockImplementation(() => {
      Object.keys(store).forEach(k => { delete store[k]; });
    });
  });

  it("saveDraft writes JSON to localStorage with correct key", () => {
    saveDraft("tpl-abc", { "f-1": "hello" });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "form-draft-tpl-abc",
      JSON.stringify({ "f-1": "hello" })
    );
  });

  it("loadDraft restores previously saved values", () => {
    store["form-draft-tpl-abc"] = JSON.stringify({ "f-1": "restored" });
    const draft = loadDraft("tpl-abc");
    expect(draft).toEqual({ "f-1": "restored" });
  });

  it("clearDraft removes the draft key", () => {
    store["form-draft-tpl-abc"] = JSON.stringify({ "f-1": "data" });
    clearDraft("tpl-abc");
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("form-draft-tpl-abc");
  });

  it("saveDraft silently ignores errors when localStorage.setItem throws", () => {
    localStorageMock.setItem.mockImplementation(() => { throw new Error("quota exceeded"); });
    expect(() => saveDraft("tpl-abc", { "f-1": "value" })).not.toThrow();
    // Restore
    localStorageMock.setItem.mockImplementation((key: string, value: string) => { store[key] = value; });
  });

  it("loadDraft silently returns null when localStorage.getItem throws", () => {
    localStorageMock.getItem.mockImplementation(() => { throw new Error("quota exceeded"); });
    let result: Record<string, string> | null | undefined;
    expect(() => { result = loadDraft("tpl-abc"); }).not.toThrow();
    expect(result).toBeNull();
    // Restore to default implementation
    localStorageMock.getItem.mockImplementation((key: string) => store[key] ?? null);
  });
});
