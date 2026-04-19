"use client";

import { useState, useEffect } from "react";
import { ProgressBar } from "@/components/onboarding/ProgressBar";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FieldType = "TEXT" | "EMAIL" | "URL" | "NUMBER" | "TEXTAREA" | "FILE" | "CHECKBOX";

export type PublicField = {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string | null;
  required: boolean;
  order: number;
};

type PublicStep = {
  id: string;
  title: string;
  order: number;
  fields: PublicField[];
};

export type PublicTemplate = {
  id: string;
  name: string;
  steps: PublicStep[];
};

// ─── Translations ────────────────────────────────────────────────────────────

const T = {
  en: {
    langBtn: "RU",
    back: "Back",
    next: "Next",
    submit: "Submit Application",
    submitting: "Submitting...",
    errRequired: "Required field",
    errEmail: "Enter a valid email",
    errUrl: "Enter a valid URL (https://...)",
    errNumber: "Enter a valid number",
    optional: "(optional)",
    successTitle: "Application submitted!",
    rateLimit: "Too many submissions. Please try again later.",
    submitError: "Submission failed. Please try again.",
    networkError: "Network error. Please try again.",
  },
  ru: {
    langBtn: "EN",
    back: "Назад",
    next: "Далее",
    submit: "Отправить заявку",
    submitting: "Отправляем...",
    errRequired: "Обязательное поле",
    errEmail: "Введите корректный email",
    errUrl: "Введите корректный URL (https://...)",
    errNumber: "Введите корректное число",
    optional: "(необязательно)",
    successTitle: "Заявка отправлена!",
    rateLimit: "Слишком много заявок. Попробуйте позже.",
    submitError: "Ошибка отправки. Попробуйте снова.",
    networkError: "Сетевая ошибка. Попробуйте снова.",
  },
} as const;

type Lang = keyof typeof T;
type Translations = (typeof T)[Lang];

// ─── localStorage draft utilities ────────────────────────────────────────────

const draftKey = (templateId: string) => `form-draft-${templateId}`;

export function saveDraft(templateId: string, values: Record<string, string>): void {
  try {
    localStorage.setItem(draftKey(templateId), JSON.stringify(values));
  } catch {
    // Silently ignore — form works without localStorage
  }
}

export function loadDraft(templateId: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(draftKey(templateId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

export function clearDraft(templateId: string): void {
  try {
    localStorage.removeItem(draftKey(templateId));
  } catch {
    // Silently ignore
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateStep(
  fields: PublicField[],
  values: Record<string, string>,
  files: Record<string, File | null>,
  t: { errRequired: string; errEmail: string; errUrl: string; errNumber: string }
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (field.type === "FILE") {
      if (field.required && !files[field.id]) errors[field.id] = t.errRequired;
      continue;
    }

    if (field.type === "CHECKBOX") {
      if (field.required && values[field.id] !== "true") errors[field.id] = t.errRequired;
      continue;
    }

    const value = (values[field.id] ?? "").trim();

    if (field.required && !value) {
      errors[field.id] = t.errRequired;
      continue; // Skip type validation — already failed required check
    }

    if (!value) continue; // Optional + empty — skip type validation

    if (field.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.id] = t.errEmail;
    }

    if (field.type === "URL") {
      try {
        const u = new URL(value);
        if (!u.protocol.startsWith("http")) errors[field.id] = t.errUrl;
      } catch {
        errors[field.id] = t.errUrl;
      }
    }

    if (field.type === "NUMBER") {
      const n = Number(value);
      if (isNaN(n) || !isFinite(n)) errors[field.id] = t.errNumber;
    }
  }

  return errors;
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

const baseCls =
  "w-full px-4 py-2.5 text-black border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const okCls = `${baseCls} border-gray-300`;
const errCls = `${baseCls} border-red-400 focus:ring-red-400`;

function Field({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-gray-400 font-normal text-xs">{optional}</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Field renderer ──────────────────────────────────────────────────────────

function renderField(
  field: PublicField,
  values: Record<string, string>,
  files: Record<string, File | null>,
  errors: Record<string, string>,
  t: Translations,
  setValue: (id: string, value: string) => void,
  setFile: (id: string, file: File | null) => void
): React.ReactNode {
  const value = values[field.id] ?? "";
  const error = errors[field.id];
  const hasError = !!error;
  const optionalLabel = !field.required ? t.optional : undefined;

  switch (field.type) {
    case "TEXT":
      return (
        <Field key={field.id} label={field.label} required={field.required} optional={optionalLabel} error={error}>
          <input
            type="text"
            className={hasError ? errCls : okCls}
            placeholder={field.placeholder ?? undefined}
            value={value}
            onChange={(e) => setValue(field.id, e.target.value)}
          />
        </Field>
      );

    case "EMAIL":
      return (
        <Field key={field.id} label={field.label} required={field.required} optional={optionalLabel} error={error}>
          <input
            type="email"
            className={hasError ? errCls : okCls}
            placeholder={field.placeholder ?? undefined}
            value={value}
            onChange={(e) => setValue(field.id, e.target.value)}
          />
        </Field>
      );

    case "URL":
      return (
        <Field key={field.id} label={field.label} required={field.required} optional={optionalLabel} error={error}>
          <input
            type="url"
            className={hasError ? errCls : okCls}
            placeholder={field.placeholder ?? undefined}
            value={value}
            onChange={(e) => setValue(field.id, e.target.value)}
          />
        </Field>
      );

    case "NUMBER":
      return (
        <Field key={field.id} label={field.label} required={field.required} optional={optionalLabel} error={error}>
          <input
            type="number"
            className={hasError ? errCls : okCls}
            placeholder={field.placeholder ?? undefined}
            value={value}
            onChange={(e) => setValue(field.id, e.target.value)}
          />
        </Field>
      );

    case "TEXTAREA":
      return (
        <Field key={field.id} label={field.label} required={field.required} optional={optionalLabel} error={error}>
          <textarea
            className={`${hasError ? errCls : okCls} resize-none`}
            rows={4}
            placeholder={field.placeholder ?? undefined}
            value={value}
            onChange={(e) => setValue(field.id, e.target.value)}
          />
        </Field>
      );

    case "CHECKBOX":
      return (
        <Field key={field.id} label={field.label} required={field.required} optional={optionalLabel} error={error}>
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={value === "true"}
            onChange={(e) => setValue(field.id, e.target.checked ? "true" : "false")}
          />
        </Field>
      );

    case "FILE":
      return (
        <Field key={field.id} label={field.label} required={field.required} optional={optionalLabel} error={error}>
          <input
            type="file"
            className={hasError ? errCls : okCls}
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setFile(field.id, e.target.files?.[0] ?? null)}
          />
        </Field>
      );

    default:
      return null;
  }
}

// ─── Main component ──────────────────────────────────────────────────────────

export function DynamicForm({ template }: { template: PublicTemplate }) {
  const [lang, setLang] = useState<Lang>("en");
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const t = T[lang];
  const currentStep = template.steps[stepIndex];
  const isLastStep = stepIndex === template.steps.length - 1;
  const stepLabels = template.steps.map((s) => s.title);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft(template.id);
    if (draft) setValues(draft);
  }, [template.id]);

  // Persist draft on every field change (skip FILE fields — not serializable)
  useEffect(() => {
    saveDraft(template.id, values);
  }, [template.id, values]);

  function setValue(fieldId: string, value: string) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  }

  function setFile(fieldId: string, file: File | null) {
    setFiles((prev) => ({ ...prev, [fieldId]: file }));
    setErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
  }

  function handleNext() {
    const errs = validateStep(currentStep.fields, values, files, t);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStepIndex((i) => i + 1);
  }

  function handleBack() {
    setStepIndex((i) => i - 1);
    setErrors({});
  }

  async function handleSubmit() {
    const errs = validateStep(currentStep.fields, values, files, t);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSubmitting(true);
    setSubmitError("");

    // Build FormData keyed by field.id (server resolves to fieldKey via template reload)
    const fd = new globalThis.FormData();
    for (const step of template.steps) {
      for (const field of step.fields) {
        if (field.type === "FILE") {
          const file = files[field.id];
          if (file) fd.append(field.id, file);
        } else {
          fd.append(field.id, values[field.id] ?? "");
        }
      }
    }

    try {
      const res = await fetch(`/api/templates/${template.id}/submit`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setSubmitError(t.rateLimit);
        } else {
          setSubmitError((json as { error?: string }).error ?? t.submitError);
        }
        setSubmitting(false);
        return;
      }

      clearDraft(template.id);
      setSubmitted(true);
    } catch {
      setSubmitError(t.networkError);
      setSubmitting(false);
    }
  }

  // ── Success screen ──

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">{t.successTitle}</h2>
      </div>
    );
  }

  // ── Form ──

  return (
    <div>
      {/* Header: logo + lang toggle */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <span className="text-lg font-semibold text-gray-900">Spayon</span>
        </div>
        <button
          onClick={() => setLang((l) => (l === "en" ? "ru" : "en"))}
          className="text-xs font-semibold text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-3 py-1.5 rounded-md transition"
        >
          {t.langBtn}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <ProgressBar current={stepIndex} labels={stepLabels} />

        <div className="space-y-5 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">{currentStep.title}</h2>

          {currentStep.fields.map((field) =>
            renderField(field, values, files, errors, t, setValue, setFile)
          )}
        </div>

        {submitError && (
          <div className="mt-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {submitError}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={handleBack}
            disabled={stepIndex === 0}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {t.back}
          </button>

          {!isLastStep ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              {t.next}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 transition"
            >
              {submitting && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {submitting ? t.submitting : t.submit}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
