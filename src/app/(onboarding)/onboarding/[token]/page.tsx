import { prisma } from "@/lib/db";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage({
  params,
}: {
  params: { token: string };
}) {
  const record = await prisma.onboardingToken.findUnique({
    where: { token: params.token },
  });

  const isInvalid = !record || record.expiresAt < new Date();
  const isUsed = !!record?.usedAt;

  if (isInvalid || isUsed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isUsed
            ? "Link already used / Ссылка уже использована"
            : "Invalid link / Ссылка недействительна"}
        </h2>
        <p className="text-gray-500 text-sm max-w-xs">
          {isUsed
            ? "This link has already been used. Please contact your manager for a new one. / По этой ссылке уже была подана заявка. Обратитесь к менеджеру для новой ссылки."
            : "This link has expired or does not exist. Please request a new one from your manager. / Ссылка устарела или не существует. Запросите новую ссылку у менеджера."}
        </p>
      </div>
    );
  }

  return <OnboardingForm token={params.token} />;
}
