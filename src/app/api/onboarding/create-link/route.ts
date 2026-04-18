import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed } = rateLimit(`create-link:${token.id}`, 20, 60 * 60 * 1000); // 20 links per user per hour
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // TODO(task-9): remove legacy token creation — OnboardingToken model deleted
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const record = await prisma.onboardingToken.create({
      data: { createdBy: token.id as string, expiresAt },
    });

    const url = `${process.env.NEXTAUTH_URL}/onboarding/${record.token}`;
    return NextResponse.json({ url, token: record.token });
  } catch (err) {
    console.error("[create-link]", err);
    return NextResponse.json({ error: "Failed to create link. Please try again." }, { status: 500 });
  }
}
