import Link from "next/link";

export function CreateLinkButton() {
  return (
    <Link
      href="/dashboard/templates"
      className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
    >
      Templates
    </Link>
  );
}
