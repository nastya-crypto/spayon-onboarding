export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";
import { SubmissionStatus } from "@/generated/prisma/client";

const VALID_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  [SubmissionStatus.NEW]: [SubmissionStatus.IN_REVIEW],
  [SubmissionStatus.IN_REVIEW]: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED],
  [SubmissionStatus.APPROVED]: [],
  [SubmissionStatus.REJECTED]: [],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { status } = body;

  const validStatuses = Object.values(SubmissionStatus) as string[];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  const newStatus = status as SubmissionStatus;

  const submission = await prisma.formSubmission.findUnique({
    where: { id: params.id },
  });

  if (!submission) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowedTransitions = VALID_TRANSITIONS[submission.status];
  if (!allowedTransitions.includes(newStatus)) {
    return NextResponse.json(
      {
        error: `Invalid transition: ${submission.status} → ${newStatus}`,
      },
      { status: 400 }
    );
  }

  const updated = await prisma.formSubmission.update({
    where: { id: params.id },
    data: { status: newStatus },
  });

  return NextResponse.json({ status: updated.status });
}
