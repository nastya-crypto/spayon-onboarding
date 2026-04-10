"use client";

import { useState } from "react";

type State = "idle" | "loading" | "copied" | "error";

export function CreateLinkButton() {
  const [state, setState] = useState<State>("idle");

  async function handleClick() {
    setState("loading");
    try {
      const res = await fetch("/api/onboarding/create-link", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const labels: Record<State, string> = {
    idle: "Создать ссылку для клиента",
    loading: "Создаём...",
    copied: "Ссылка скопирована!",
    error: "Ошибка, попробуйте снова",
  };

  const colors: Record<State, string> = {
    idle: "bg-blue-600 hover:bg-blue-700",
    loading: "bg-blue-400 cursor-not-allowed",
    copied: "bg-green-600",
    error: "bg-red-500",
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className={`inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors ${colors[state]}`}
    >
      {state === "loading" && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {state === "copied" && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state === "idle" && (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )}
      {labels[state]}
    </button>
  );
}
