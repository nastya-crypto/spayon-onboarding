import { DynamicForm } from "./DynamicForm";
import type { PublicTemplate } from "./DynamicForm";

export default async function PublicFormPage({
  params,
}: {
  params: { templateId: string };
}) {
  const { templateId } = params;
  const baseUrl = process.env.NEXTAUTH_URL ?? "";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/templates/${templateId}/public`, {
      cache: "no-store",
    });
  } catch {
    // Network error — let Next.js error boundary handle
    throw new Error("Failed to reach template service");
  }

  if (res.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          This link is no longer available
        </h1>
        <p className="text-gray-500 max-w-sm">
          The onboarding form you&apos;re looking for has been removed or does not exist.
          Please contact your Spayon manager to get a new link.
        </p>
      </div>
    );
  }

  if (!res.ok) {
    throw new Error(`Template fetch failed with status ${res.status}`);
  }

  const template = (await res.json()) as PublicTemplate;
  return <DynamicForm template={template} />;
}
