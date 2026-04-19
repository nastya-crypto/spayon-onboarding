export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";
import { StatsCard } from "@/components/dashboard/StatsCard";
// TODO(task-9): rename MerchantsTable.tsx to SubmissionsTable.tsx when legacy merchants code is removed
import { SubmissionsTable } from "@/components/dashboard/MerchantsTable";

async function getSubmissionsData() {
  const [submissions, counts] = await Promise.all([
    prisma.formSubmission.findMany({
      select: {
        id: true,
        companyName: true,
        templateName: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.formSubmission.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const stats = { NEW: 0, IN_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
  for (const c of counts) {
    stats[c.status] = c._count.status;
  }

  const serialized = submissions.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  }));

  return { submissions: serialized, stats };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "REVIEWER") {
    redirect("/login");
  }
  // Note: this page uses direct Prisma access so REVIEWER role works here.
  // GET /api/submissions is ADMIN-only — a deliberate tradeoff until RBAC is
  // unified (tracked: auth asymmetry between page and API layers).

  const { submissions, stats } = await getSubmissionsData();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage client onboarding submissions</p>
        </div>
        <Link
          href="/dashboard/templates"
          className="inline-flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          Templates
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="New"
          value={stats.NEW}
          borderColor="border-blue-500"
          textColor="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatsCard
          title="In Review"
          value={stats.IN_REVIEW}
          borderColor="border-yellow-500"
          textColor="text-yellow-600"
          bgColor="bg-yellow-50"
        />
        <StatsCard
          title="Approved"
          value={stats.APPROVED}
          borderColor="border-green-500"
          textColor="text-green-600"
          bgColor="bg-green-50"
        />
        <StatsCard
          title="Rejected"
          value={stats.REJECTED}
          borderColor="border-red-500"
          textColor="text-red-600"
          bgColor="bg-red-50"
        />
      </div>

      {/* Table */}
      <SubmissionsTable submissions={submissions} />
    </div>
  );
}
