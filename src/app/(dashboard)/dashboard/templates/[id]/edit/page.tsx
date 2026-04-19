export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";
import { EditTemplatePage } from "./EditTemplatePage";

type Props = {
  params: { id: string };
};

export default async function EditTemplatePageServer({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "REVIEWER") {
    redirect("/login");
  }

  const template = await prisma.formTemplate.findUnique({
    where: { id: params.id },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: {
          fields: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!template) notFound();

  const initialData = {
    name: template.name,
    steps: template.steps.map((s) => ({
      id: s.id,
      title: s.title,
      fields: s.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type as
          | "TEXT"
          | "EMAIL"
          | "URL"
          | "NUMBER"
          | "TEXTAREA"
          | "FILE"
          | "CHECKBOX",
        placeholder: f.placeholder,
        required: f.required,
        isProtected: f.isProtected,
      })),
    })),
  };

  return <EditTemplatePage templateId={params.id} initialData={initialData} />;
}
