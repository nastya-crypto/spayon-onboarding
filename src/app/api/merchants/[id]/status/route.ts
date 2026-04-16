import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (token.role !== "ADMIN" && token.role !== "REVIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { status?: string };
  const { status } = body;

  const allowed = ["NEW", "IN_REVIEW", "APPROVED", "REJECTED"] as const;
  if (!status || !allowed.includes(status as (typeof allowed)[number])) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const merchant = await prisma.merchant.findUnique({ where: { id: params.id } });
  if (!merchant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.merchant.update({
    where: { id: params.id },
    data: { status: status as "NEW" | "IN_REVIEW" | "APPROVED" | "REJECTED" },
  });

  return NextResponse.json({ status: updated.status });
}
