"use client";

import { useState, useRef } from "react";
import { ProgressBar } from "@/components/onboarding/ProgressBar";

// ─── Translations ───────────────────────────────────────────────────────────

const T = {
  en: {
    stepNames: ["About the Project", "Contacts", "Business Profile", "Documents"],
    langBtn: "RU",
    // Step 1
    s1title: "About the Project",
    projectName: "Project name",
    websiteUrl: "Website URL",
    websitePh: "https://example.com",
    paymentUrls: "Payment button URLs",
    addUrl: "+ Add URL",
    urlPlaceholder: "https://example.com/checkout",
    servicesProvided: "Services provided by the project",
    servicesPh: "Describe the services your project provides...",
    // Step 2
    s2title: "Contacts",
    contactName: "Contact person name",
    email: "Email",
    telegram: "Telegram",
    telegramPh: "@username",
    // Step 3
    s3title: "Business Profile",
    projectAge: "Project age",
    projectAgePh: "e.g. 2 years, 6 months",
    chargebackRate: "Average chargeback rate (%)",
    refundRate: "Average refund rate (%)",
    // Step 4
    s4title: "Documents",
    privacyPolicy: "Privacy Policy URL",
    terms: "Terms & Conditions URL",
    refundPolicy: "Refund Policy URL",
    noDocs: "We don't have these documents yet",
    logo: "Project Logo",
    logoHint: "PNG, JPG or SVG",
    logoUpload: "Click to upload",
    // Buttons
    back: "Back",
    next: "Next",
    submit: "Submit Application",
    submitting: "Submitting...",
    // Errors
    errRequired: "Required field",
    errEmail: "Enter a valid email",
    errUrl: "Enter a valid URL (https://...)",
    errLogo: "Please upload your project logo",
    errRate: "Enter a value between 0 and 100",
    errPaymentUrl: "Add at least one payment URL",
    // Labels
    optional: "(optional)",
    // Success
    successTitle: "Application submitted!",
    successMsg: "We will contact you within 24 hours at",
  },
  ru: {
    stepNames: ["О проекте", "Контакты", "Бизнес профиль", "Документы"],
    langBtn: "EN",
    s1title: "О проекте",
    projectName: "Название проекта",
    websiteUrl: "Сайт проекта",
    websitePh: "https://example.com",
    paymentUrls: "URL страниц с кнопкой оплаты",
    addUrl: "+ Добавить URL",
    urlPlaceholder: "https://example.com/checkout",
    servicesProvided: "Перечень услуг проекта",
    servicesPh: "Опишите услуги вашего проекта...",
    s2title: "Контакты",
    contactName: "Имя контактного лица",
    email: "Email",
    telegram: "Telegram",
    telegramPh: "@username",
    s3title: "Бизнес профиль",
    projectAge: "Возраст проекта",
    projectAgePh: "например: 2 года, 6 месяцев",
    chargebackRate: "Средний % чарджбэков",
    refundRate: "Средний % рефандов",
    s4title: "Документы",
    privacyPolicy: "Privacy Policy URL",
    terms: "Terms & Conditions URL",
    refundPolicy: "Refund Policy URL",
    noDocs: "У нас пока нет этих документов",
    logo: "Логотип проекта",
    logoHint: "PNG, JPG или SVG",
    logoUpload: "Нажмите для загрузки",
    back: "Назад",
    next: "Далее",
    submit: "Отправить заявку",
    submitting: "Отправляем...",
    errRequired: "Обязательное поле",
    errEmail: "Введите корректный email",
    errUrl: "Введите корректный URL (https://...)",
    errLogo: "Загрузите логотип проекта",
    errRate: "Введите значение от 0 до 100",
    errPaymentUrl: "Добавьте хотя бы один URL",
    optional: "(необязательно)",
    successTitle: "Заявка отправлена!",
    successMsg: "Мы свяжемся с вами в течение 24 часов по адресу",
  },
} as const;

type Lang = keyof typeof T;
type Translations = (typeof T)[Lang];

// ─── Form data ───────────────────────────────────────────────────────────────

type FormData = {
  companyName: string;
  websiteUrl: string;
  paymentUrls: string[];
  servicesProvided: string;
  contactName: string;
  email: string;
  telegram: string;
  projectAge: string;
  chargebackRate: string;
  refundRate: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  refundPolicyUrl: string;
  noLegalDocs: boolean;
};

const INITIAL: FormData = {
  companyName: "",
  websiteUrl: "",
  paymentUrls: [""],
  servicesProvided: "",
  contactName: "",
  email: "",
  telegram: "",
  projectAge: "",
  chargebackRate: "",
  refundRate: "",
  privacyPolicyUrl: "",
  termsUrl: "",
  refundPolicyUrl: "",
  noLegalDocs: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

function validate(step: number, data: FormData, logo: File | null, t: Translations): Record<string, string> {
  const e: Record<string, string> = {};

  if (step === 0) {
    if (!data.companyName.trim()) e.companyName = t.errRequired;
    if (!data.websiteUrl.trim()) e.websiteUrl = t.errRequired;
    else if (!isUrl(data.websiteUrl)) e.websiteUrl = t.errUrl;
    const filled = data.paymentUrls.filter(u => u.trim());
    if (filled.length === 0) e.paymentUrls = t.errPaymentUrl;
    data.paymentUrls.forEach((url, i) => {
      if (url.trim() && !isUrl(url)) e[`paymentUrl_${i}`] = t.errUrl;
    });
    if (!data.servicesProvided.trim()) e.servicesProvided = t.errRequired;
  }

  if (step === 1) {
    if (!data.contactName.trim()) e.contactName = t.errRequired;
    if (!data.email.trim()) e.email = t.errRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = t.errEmail;
  }

  if (step === 2) {
    if (!data.projectAge.trim()) e.projectAge = t.errRequired;
    if (data.chargebackRate === "") e.chargebackRate = t.errRequired;
    else if (isNaN(+data.chargebackRate) || +data.chargebackRate < 0 || +data.chargebackRate > 100)
      e.chargebackRate = t.errRate;
    if (data.refundRate === "") e.refundRate = t.errRequired;
    else if (isNaN(+data.refundRate) || +data.refundRate < 0 || +data.refundRate > 100)
      e.refundRate = t.errRate;
  }

  if (step === 3) {
    if (!logo) e.logo = t.errLogo;
    if (!data.noLegalDocs) {
      if (data.privacyPolicyUrl && !isUrl(data.privacyPolicyUrl)) e.privacyPolicyUrl = t.errUrl;
      if (data.termsUrl && !isUrl(data.termsUrl)) e.termsUrl = t.errUrl;
      if (data.refundPolicyUrl && !isUrl(data.refundPolicyUrl)) e.refundPolicyUrl = t.errUrl;
    }
  }

  return e;
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

const baseCls = "w-full px-4 py-2.5 text-black border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
const okCls = `${baseCls} border-gray-300`;
const errCls = `${baseCls} border-red-400 focus:ring-red-400`;

function Field({
  label, required, optional, error, children,
}: {
  label: string; required?: boolean; optional?: string; error?: string; children: React.ReactNode;
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

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingForm({ token }: { token: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL);
  const [logo, setLogo] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);

  const t = T[lang];

  // ── Field helpers ──

  function clearError(...keys: string[]) {
    setErrors(prev => {
      const next = { ...prev };
      keys.forEach(k => { delete next[k]; });
      return next;
    });
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(d => ({ ...d, [key]: value }));
    clearError(key);
  }

  function setUrl(i: number, value: string) {
    const urls = [...data.paymentUrls];
    urls[i] = value;
    setData(d => ({ ...d, paymentUrls: urls }));
    clearError("paymentUrls", `paymentUrl_${i}`);
  }

  function addUrl() { setData(d => ({ ...d, paymentUrls: [...d.paymentUrls, ""] })); }

  function removeUrl(i: number) {
    setData(d => ({ ...d, paymentUrls: d.paymentUrls.filter((_, idx) => idx !== i) }));
  }

  // ── Navigation ──

  function next() {
    const errs = validate(step, data, logo, t);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(s => s + 1);
  }

  function back() { setStep(s => s - 1); setErrors({}); }

  // ── Submit ──

  async function handleSubmit() {
    const errs = validate(3, data, logo, t);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setSubmitError("");

    const fd = new globalThis.FormData();
    fd.append("token", token);
    fd.append("companyName", data.companyName);
    fd.append("websiteUrl", data.websiteUrl);
    fd.append("paymentUrls", JSON.stringify(data.paymentUrls.filter(u => u.trim())));
    fd.append("servicesProvided", data.servicesProvided);
    fd.append("contactName", data.contactName);
    fd.append("email", data.email);
    fd.append("telegram", data.telegram);
    fd.append("projectAge", data.projectAge);
    fd.append("chargebackRate", data.chargebackRate);
    fd.append("refundRate", data.refundRate);
    fd.append("privacyPolicyUrl", data.privacyPolicyUrl);
    fd.append("termsUrl", data.termsUrl);
    fd.append("refundPolicyUrl", data.refundPolicyUrl);
    fd.append("noLegalDocs", String(data.noLegalDocs));
    if (logo) fd.append("logo", logo);

    try {
      const res = await fetch("/api/onboarding/submit", { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSubmitError((json as { error?: string }).error || "Submission failed. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError(lang === "en" ? "Network error. Please try again." : "Сетевая ошибка. Попробуйте снова.");
    } finally {
      setLoading(false);
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
        <p className="text-gray-600 max-w-sm">
          {t.successMsg} <strong>{data.email}</strong>
        </p>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-gray-900">Spayon</span>
        </div>
        <button
          onClick={() => setLang(l => l === "en" ? "ru" : "en")}
          className="text-xs font-semibold text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-3 py-1.5 rounded-md transition"
        >
          {t.langBtn}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <ProgressBar current={step} labels={t.stepNames} />

      <div className="space-y-5">

        {/* ── Step 1: Company Information ── */}
        {step === 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{t.s1title}</h2>

            <Field label={t.projectName} required error={errors.companyName}>
              <input
                className={errors.companyName ? errCls : okCls}
                placeholder="Spayon"
                value={data.companyName}
                onChange={e => set("companyName", e.target.value)}
              />
            </Field>

            <Field label={t.websiteUrl} required error={errors.websiteUrl}>
              <input
                type="url"
                className={errors.websiteUrl ? errCls : okCls}
                placeholder={t.websitePh}
                value={data.websiteUrl}
                onChange={e => set("websiteUrl", e.target.value)}
              />
            </Field>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                {t.paymentUrls} <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {data.paymentUrls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className={`flex-1 ${errors[`paymentUrl_${i}`] ? errCls : okCls}`}
                      placeholder={t.urlPlaceholder}
                      value={url}
                      onChange={e => setUrl(i, e.target.value)}
                    />
                    {data.paymentUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeUrl(i)}
                        className="px-2.5 py-2 text-gray-400 hover:text-red-500 border border-gray-300 rounded-lg hover:border-red-300 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {errors[`paymentUrl_${i}`] && (
                      <p className="mt-1 text-xs text-red-500 col-span-2">{errors[`paymentUrl_${i}`]}</p>
                    )}
                  </div>
                ))}
              </div>
              {errors.paymentUrls && <p className="mt-1 text-xs text-red-500">{errors.paymentUrls}</p>}
              <button
                type="button"
                onClick={addUrl}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {t.addUrl}
              </button>
            </div>

            <Field label={t.servicesProvided} required error={errors.servicesProvided}>
              <textarea
                className={`${errors.servicesProvided ? errCls : okCls} resize-none`}
                rows={4}
                placeholder={t.servicesPh}
                value={data.servicesProvided}
                onChange={e => set("servicesProvided", e.target.value)}
              />
            </Field>
          </>
        )}

        {/* ── Step 2: Contact Details ── */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{t.s2title}</h2>

            <Field label={t.contactName} required error={errors.contactName}>
              <input
                className={errors.contactName ? errCls : okCls}
                placeholder="Ivan Petrov"
                value={data.contactName}
                onChange={e => set("contactName", e.target.value)}
              />
            </Field>

            <Field label={t.email} required error={errors.email}>
              <input
                type="email"
                className={errors.email ? errCls : okCls}
                placeholder="ivan@company.com"
                value={data.email}
                onChange={e => set("email", e.target.value)}
              />
            </Field>

            <Field label={t.telegram} optional={t.optional}>
              <input
                className={okCls}
                placeholder={t.telegramPh}
                value={data.telegram}
                onChange={e => set("telegram", e.target.value)}
              />
            </Field>
          </>
        )}

        {/* ── Step 3: Risk Profile ── */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{t.s3title}</h2>

            <Field label={t.projectAge} required error={errors.projectAge}>
              <input
                className={errors.projectAge ? errCls : okCls}
                placeholder={t.projectAgePh}
                value={data.projectAge}
                onChange={e => set("projectAge", e.target.value)}
              />
            </Field>

            <Field label={t.chargebackRate} required error={errors.chargebackRate}>
              <div className="relative">
                <input
                  type="number"
                  min="0" max="100" step="0.1"
                  className={`${errors.chargebackRate ? errCls : okCls} pr-10`}
                  placeholder="0"
                  value={data.chargebackRate}
                  onChange={e => { set("chargebackRate", e.target.value); }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </Field>

            <Field label={t.refundRate} required error={errors.refundRate}>
              <div className="relative">
                <input
                  type="number"
                  min="0" max="100" step="0.1"
                  className={`${errors.refundRate ? errCls : okCls} pr-10`}
                  placeholder="0"
                  value={data.refundRate}
                  onChange={e => { set("refundRate", e.target.value); }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </Field>
          </>
        )}

        {/* ── Step 4: Documents ── */}
        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-5">{t.s4title}</h2>

            {/* No-docs checkbox */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={data.noLegalDocs}
                onChange={e => set("noLegalDocs", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{t.noDocs}</span>
            </label>

            {/* URL fields — hidden when noLegalDocs */}
            {!data.noLegalDocs && (
              <div className="space-y-4 pt-1">
                <Field label={t.privacyPolicy} optional={t.optional} error={errors.privacyPolicyUrl}>
                  <input
                    type="url"
                    className={errors.privacyPolicyUrl ? errCls : okCls}
                    placeholder="https://example.com/privacy"
                    value={data.privacyPolicyUrl}
                    onChange={e => { set("privacyPolicyUrl", e.target.value); }}
                  />
                </Field>

                <Field label={t.terms} optional={t.optional} error={errors.termsUrl}>
                  <input
                    type="url"
                    className={errors.termsUrl ? errCls : okCls}
                    placeholder="https://example.com/terms"
                    value={data.termsUrl}
                    onChange={e => { set("termsUrl", e.target.value); }}
                  />
                </Field>

                <Field label={t.refundPolicy} optional={t.optional} error={errors.refundPolicyUrl}>
                  <input
                    type="url"
                    className={errors.refundPolicyUrl ? errCls : okCls}
                    placeholder="https://example.com/refunds"
                    value={data.refundPolicyUrl}
                    onChange={e => { set("refundPolicyUrl", e.target.value); }}
                  />
                </Field>
              </div>
            )}

            {/* Logo upload */}
            <LogoUpload
              label={t.logo}
              hint={t.logoHint}
              uploadText={t.logoUpload}
              file={logo}
              error={errors.logo}
              inputRef={logoRef}
              onChange={f => { setLogo(f); clearError("logo"); }}
            />
          </>
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mt-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {t.back}
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={next}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            {t.next}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 transition"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? t.submitting : t.submit}
          </button>
        )}
      </div>
      </div>{/* /card */}
    </div>
  );
}

// ─── Logo upload subcomponent ────────────────────────────────────────────────

function LogoUpload({
  label, hint, uploadText, file, error, inputRef, onChange,
}: {
  label: string; hint: string; uploadText: string;
  file: File | null; error?: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (f: File | null) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
        {label} <span className="text-red-500">*</span>
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-5 flex items-center gap-4 cursor-pointer transition
          ${file ? "border-blue-400 bg-blue-50" : error ? "border-red-400 bg-red-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"}`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".png,.jpg,.jpeg,.svg"
          onChange={e => onChange(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <div className="w-10 h-10 rounded-lg bg-white border border-blue-200 flex items-center justify-center shrink-0 overflow-hidden">
              {file.type.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={URL.createObjectURL(file)} alt="logo" className="w-full h-full object-contain" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-700 truncate">{file.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ""; }}
              className="text-gray-400 hover:text-red-500 shrink-0 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{uploadText}</p>
              <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
            </div>
          </>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
