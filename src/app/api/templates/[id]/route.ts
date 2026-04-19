export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";

// ── Zod schemas (same shape as POST) ─────────────────────────────────────────

const fieldSchema = z.object({
  label: z.string().min(1).max(255),
  placeholder: z.string().max(500).optional(),
  type: z.enum(["TEXT", "EMAIL", "URL", "NUMBER", "TEXTAREA", "FILE", "CHECKBOX"]),
  required: z.boolean().default(true),
  fieldKey: z.string().max(255).optional(),
  isProtected: z.boolean().optional(),
});

const stepSchema = z.object({
  title: z.string().min(1).max(255),
  fields: z.array(fieldSchema).min(1),
});

const templateBodySchema = z.object({
  name: z.string().min(1).max(255),
  steps: z.array(stepSchema).min(1),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function toFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = await prisma.formTemplate.findUnique({
    where: { id: params.id },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: { fields: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(template);
}

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

  const body = await req.json();
  const parsed = templateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const existing = await prisma.formTemplate.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Guard: all protected fields must remain in the incoming body
  const protectedFields = await prisma.formField.findMany({
    where: { step: { templateId: params.id }, isProtected: true },
  });

  const incomingFieldKeys = parsed.data.steps.flatMap((s) =>
    s.fields.map((f) => f.fieldKey ?? toFieldKey(f.label))
  );

  for (const pf of protectedFields) {
    if (!incomingFieldKeys.includes(pf.fieldKey)) {
      return NextResponse.json(
        { error: "Company Name field cannot be removed" },
        { status: 400 }
      );
    }
  }

  const { name, steps } = parsed.data;

  // Full-replacement in a single interactive transaction
  const updatedTemplate = await prisma.$transaction(async (tx) => {
    await tx.formStep.deleteMany({ where: { templateId: params.id } });

    await tx.formTemplate.update({
      where: { id: params.id },
      data: { name },
    });

    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
      const step = steps[stepIdx];
      const createdStep = await tx.formStep.create({
        data: { templateId: params.id, title: step.title, order: stepIdx },
      });
      for (let fieldIdx = 0; fieldIdx < step.fields.length; fieldIdx++) {
        const field = step.fields[fieldIdx];
        await tx.formField.create({
          data: {
            stepId: createdStep.id,
            label: field.label,
            fieldKey: field.fieldKey ?? toFieldKey(field.label),
            type: field.type,
            placeholder: field.placeholder ?? null,
            required: field.required,
            isProtected: field.isProtected ?? false,
            order: fieldIdx,
          },
        });
      }
    }


    return tx.formTemplate.findUnique({
      where: { id: params.id },
      include: {
        steps: {
          orderBy: { order: "asc" },
          include: { fields: { orderBy: { order: "asc" } } },
        },
      },
    });
  });

  return NextResponse.json(updatedTemplate);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.formTemplate.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.formTemplate.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
