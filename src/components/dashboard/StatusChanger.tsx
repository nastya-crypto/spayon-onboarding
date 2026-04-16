"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "NEW" | "IN_REVIEW" | "APPROVED" | "REJECTED";

const BUTTONS: { status: Status; label: string; active: string; idle: string }[] = [
  {
    status: "IN_REVIEW",
    label: "Mark as In Review",
    active: "bg-yellow-500 text-white border-yellow-500",
    idle: "border-yellow-400 text-yellow-600 hover:bg-yellow-50",
  },
  {
    status: "APPROVED",
    label: "Approve",
    active: "bg-green-600 text-white border-green-600",
    idle: "border-green-500 text-green-600 hover:bg-green-50",
  },
  {
    status: "REJECTED",
    label: "Reject",
    active: "bg-red-600 text-white border-red-600",
    idle: "border-red-400 text-red-600 hover:bg-red-50",
  },
];

export function StatusChanger({
  merchantId,
  currentStatus,
}: {
  merchantId: string;
  currentStatus: Status;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(status: Status) {
    if (status === currentStatus) return;
    setLoading(status);
    setError(null);
    try {
      const res = await fetch(`/api/merchants/${merchantId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError((json as { error?: string }).error ?? "Failed to update status");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Change Status
      </h2>
      {error && (
        <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {BUTTONS.map(({ status, label, active, idle }) => {
          const isCurrent = currentStatus === status;
          const isLoading = loading === status;
          return (
            <button
              key={status}
              onClick={() => changeStatus(status)}
              disabled={isLoading || loading !== null}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition
                ${isCurrent ? active : idle}
                disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isLoading && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {isCurrent && !isLoading && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
