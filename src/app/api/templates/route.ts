export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";

// ── Zod schemas ──────────────────────────────────────────────────────────────

const fieldSchema = z.object({
  label: z.string().min(1).max(255),
  placeholder: z.string().max(500).optional(),
  type: z.enum(["TEXT", "EMAIL", "URL", "NUMBER", "TEXTAREA", "FILE", "CHECKBOX"]),
  required: z.boolean().default(true),
  fieldKey: z.string().max(255).optional(),
});

const stepSchema = z.object({
  title: z.string().min(1).max(255),
  fields: z.array(fieldSchema).min(1),
});

const templateBodySchema = z.object({
  name: z.string().min(1).max(255),
  steps: z.array(stepSchema).min(1),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function toFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await prisma.formTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { steps: true } },
      steps: { include: { _count: { select: { fields: true } } } },
    },
  });

  const templates = raw.map(({ steps, ...t }) => ({
    ...t,
    fieldCount: steps.reduce((sum, s) => sum + s._count.fields, 0),
  }));

  return NextResponse.json({ templates });
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
  const parsed = templateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { name, steps } = parsed.data;

  // Auto-prepend Company Name protected field to first step
  const companyNameField = {
    label: "Company Name",
    fieldKey: "company-name",
    type: "TEXT" as const,
    required: true,
    isProtected: true,
    order: 0,
  };

  const normalizedSteps = steps.map((step, stepIdx) => ({
    title: step.title,
    order: stepIdx,
    fields: [
      ...(stepIdx === 0 ? [companyNameField] : []),
      ...step.fields.map((f, i) => ({
        label: f.label,
        fieldKey: f.fieldKey ?? toFieldKey(f.label),
        type: f.type,
        placeholder: f.placeholder ?? null,
        required: f.required,
        isProtected: false,
        order: stepIdx === 0 ? i + 1 : i,
      })),
    ],
  }));

  const template = await prisma.formTemplate.create({
    data: {
      name,
      steps: {
        create: normalizedSteps.map((step) => ({
          title: step.title,
          order: step.order,
          fields: {
            create: step.fields,
          },
        })),
      },
    },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: { fields: { orderBy: { order: "asc" } } },
      },
    },
  });

  return NextResponse.json(template, { status: 201 });
}
