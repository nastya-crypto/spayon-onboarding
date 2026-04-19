export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";
import { TemplatesTable } from "./TemplatesTable";

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "REVIEWER") {
    redirect("/login");
  }

  const templates = await prisma.formTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });

  const serialized = templates.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  const baseUrl = process.env.NEXTAUTH_URL ?? "";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Manage onboarding form templates</p>
        </div>
        <Link
          href="/dashboard/templates/new"
          className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          New Template
        </Link>
      </div>

      <TemplatesTable templates={serialized} baseUrl={baseUrl} />
    </div>
  );
}
