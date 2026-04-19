export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const template = await prisma.formTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      steps: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          order: true,
          fields: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              label: true,
              type: true,
              placeholder: true,
              required: true,
              order: true,
              // isProtected and fieldKey intentionally excluded — internal only
            },
          },
        },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Explicit mapping ensures no internal fields leak even when Prisma mock returns them
  const response = {
    id: template.id,
    name: template.name,
    steps: template.steps.map((step) => ({
      id: step.id,
      title: step.title,
      order: step.order,
      fields: step.fields.map(({ id, label, type, placeholder, required, order }) => ({
        id,
        label,
        type,
        placeholder,
        required,
        order,
      })),
    })),
  };

  return NextResponse.json(response);
}
