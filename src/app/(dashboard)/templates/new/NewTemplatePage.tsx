"use client";

import { useRouter } from "next/navigation";
import { TemplateEditor } from "@/components/dashboard/TemplateEditor";
import type { SavePayload } from "@/components/dashboard/TemplateEditorUtils";

export function NewTemplatePage() {
  const router = useRouter();

  async function handleSave(data: SavePayload) {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to create template");
    }

    router.push("/dashboard/templates");
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Template</h1>
        <p className="text-sm text-gray-500 mt-1">Create a new onboarding form template</p>
      </div>
      <TemplateEditor onSave={handleSave} />
    </div>
  );
}
