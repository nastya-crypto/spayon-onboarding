export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { MerchantsTable } from "@/components/dashboard/MerchantsTable";
import { CreateLinkButton } from "@/components/dashboard/CreateLinkButton";

async function getMerchantsData() {
  const [merchants, counts] = await Promise.all([
    prisma.merchant.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.merchant.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const stats = { NEW: 0, IN_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
  for (const c of counts) {
    stats[c.status] = c._count.status;
  }

  const serialized = merchants.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  return { merchants: serialized, stats };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "REVIEWER") {
    redirect("/login");
  }

  const { merchants, stats } = await getMerchantsData();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Заявки мерчантов</h1>
          <p className="text-sm text-gray-500 mt-1">Управление онбордингом клиентов</p>
        </div>
        <CreateLinkButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Новые"
          value={stats.NEW}
          borderColor="border-blue-500"
          textColor="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatsCard
          title="На проверке"
          value={stats.IN_REVIEW}
          borderColor="border-yellow-500"
          textColor="text-yellow-600"
          bgColor="bg-yellow-50"
        />
        <StatsCard
          title="Одобрены"
          value={stats.APPROVED}
          borderColor="border-green-500"
          textColor="text-green-600"
          bgColor="bg-green-50"
        />
        <StatsCard
          title="Отклонены"
          value={stats.REJECTED}
          borderColor="border-red-500"
          textColor="text-red-600"
          bgColor="bg-red-50"
        />
      </div>

      {/* Table */}
      <MerchantsTable merchants={merchants} />
    </div>
  );
}
