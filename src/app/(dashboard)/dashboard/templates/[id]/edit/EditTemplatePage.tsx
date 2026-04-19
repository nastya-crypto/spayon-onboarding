"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TemplateEditor } from "@/components/dashboard/TemplateEditor";
import type { SavePayload } from "@/components/dashboard/TemplateEditorUtils";
import type { FieldType } from "@/components/dashboard/TemplateEditorUtils";

type InitialData = {
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

type EditTemplatePageProps = {
  templateId: string;
  initialData: InitialData;
};

export function EditTemplatePage({ templateId, initialData }: EditTemplatePageProps) {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave(data: SavePayload) {
    setSaveError(null);
    const res = await fetch(`/api/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.error ?? "Failed to update template";
      setSaveError(msg);
    }

    router.push("/dashboard/templates");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
        <p className="text-sm text-gray-500 mt-1">Update the onboarding form template</p>
      </div>
      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {saveError}
        </div>
      )}
      <TemplateEditor initialData={initialData} onSave={handleSave} />
    </div>
  );
}
