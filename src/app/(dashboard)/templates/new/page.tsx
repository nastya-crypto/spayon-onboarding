export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { NewTemplatePage } from "./NewTemplatePage";

export default async function NewTemplatePageServer() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "REVIEWER") {
    redirect("/login");
  }

  return <NewTemplatePage />;
}
