"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TemplateRow = {
  id: string;
  name: string;
  createdAt: Date | string;
};

type TemplatesTableProps = {
  templates: TemplateRow[];
  baseUrl: string;
};

export function TemplatesTable({ templates, baseUrl }: TemplatesTableProps) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCopyLink(id: string) {
    const url = `${baseUrl}/onboarding/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback when clipboard API is unavailable (e.g. non-HTTPS)
      window.alert(`Copy this link manually:\n${url}`);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(`Delete failed: ${body.error ?? res.statusText}`);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (templates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm flex flex-col items-center justify-center py-20 text-gray-400">
        <svg
          className="w-12 h-12 mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-base font-medium">No templates yet</p>
        <p className="text-sm mt-1">Create your first template to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
            <th className="text-left px-6 py-3 font-medium text-gray-500">Created</th>
            <th className="text-left px-6 py-3 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {templates.map((tpl) => (
            <tr key={tpl.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 font-medium text-gray-900">{tpl.name}</td>
              <td className="px-6 py-4 text-gray-600">
                {new Date(tpl.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <a
                    href={`/dashboard/templates/${tpl.id}/edit`}
                    className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                  >
                    Edit
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(tpl.id)}
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    {copiedId === tpl.id ? "Copied!" : "Copy Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tpl.id)}
                    disabled={deletingId === tpl.id}
                    className="text-red-500 hover:text-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === tpl.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
