import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "REVIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  return NextResponse.json({ merchants, stats });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { businessName } = body;

  if (!businessName) {
    return NextResponse.json({ error: "businessName is required" }, { status: 400 });
  }

  const merchant = await prisma.merchant.create({
    data: { businessName, userId: session.user.id },
    include: { user: { select: { email: true } } },
  });

  return NextResponse.json(merchant, { status: 201 });
}
