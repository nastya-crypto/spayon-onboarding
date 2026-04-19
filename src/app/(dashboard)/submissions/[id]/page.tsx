export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db";
import { StatusChanger } from "@/components/dashboard/StatusChanger";
import { isValidFileUrl } from "@/lib/submission-utils";

type Status = "NEW" | "IN_REVIEW" | "APPROVED" | "REJECTED";

const STATUS_BADGE: Record<Status, string> = {
  NEW: "bg-gray-100 text-gray-700",
  IN_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<Status, string> = {
  NEW: "New",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <dt className="text-sm text-gray-500 sm:w-48 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 font-medium break-all">
        {value ?? <span className="text-gray-400 font-normal">—</span>}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

function renderFieldValue(value: string, fieldType: string): React.ReactNode {
  if (fieldType === "CHECKBOX") {
    return value === "true" ? "Yes" : value === "false" ? "No" : value;
  }

  if (fieldType === "FILE") {
    let parsed: { url?: string; mimeType?: string; size?: number } = {};
    try {
      parsed = JSON.parse(value);
    } catch {
      return <span className="text-gray-600">{value}</span>;
    }

    const url = parsed.url ?? "";
    if (isValidFileUrl(url)) {
      return (
        <a
          href={url}
          download
          className="text-blue-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download file{parsed.size != null ? ` (${parsed.size} bytes)` : ""}
        </a>
      );
    }
    return <span className="text-gray-600">{value}</span>;
  }

  return <span>{value}</span>;
}

export default async function SubmissionPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "REVIEWER") {
    redirect("/login");
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: params.id },
    include: {
      responses: true,
      template: {
        include: {
          steps: {
            orderBy: { order: "asc" },
            include: { fields: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  if (!submission) notFound();

  const statusRaw = submission.status as string;
  const status: Status = statusRaw in STATUS_BADGE ? (statusRaw as Status) : "NEW";

  // Build a set of all field IDs present in the template
  const templateFieldIds = new Set<string>();
  for (const step of submission.template?.steps ?? []) {
    for (const field of step.fields) {
      templateFieldIds.add(field.id);
    }
  }

  // Build a map of fieldId -> response for quick lookup
  const responsesByFieldId = new Map<string, (typeof submission.responses)[0]>();
  for (const response of submission.responses) {
    if (response.fieldId) {
      responsesByFieldId.set(response.fieldId, response);
    }
  }

  // Orphan responses: fieldId is null OR fieldId not found in any template field
  const orphanResponses = submission.responses.filter(
    (r) => r.fieldId === null || !templateFieldIds.has(r.fieldId)
  );

  const createdAt = new Date(submission.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">{submission.companyName}</h1>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {submission.templateName} &middot; Submitted {createdAt}
        </p>
      </div>

      {/* Deleted template warning */}
      {submission.templateId === null && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <svg
            className="w-5 h-5 text-amber-500 mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Template was deleted.</span> Field grouping is unavailable,
            but all submitted responses are still shown below.
          </p>
        </div>
      )}

      {/* Responses grouped by step */}
      {submission.template?.steps.map((step) => {
        const stepResponses = step.fields
          .map((field) => ({ field, response: responsesByFieldId.get(field.id) }))
          .filter(({ response }) => response !== undefined);

        if (stepResponses.length === 0) return null;

        return (
          <Section key={step.id} title={step.title}>
            {stepResponses.map(({ field, response }) => (
              <InfoRow
                key={field.id}
                label={field.label}
                value={response ? renderFieldValue(response.value, field.type) : null}
              />
            ))}
          </Section>
        );
      })}

      {/* Orphan responses */}
      {orphanResponses.length > 0 && (
        <Section title="Other responses">
          {orphanResponses.map((response) => (
            <InfoRow
              key={response.id}
              label={response.fieldLabel}
              value={<span>{response.value}</span>}
            />
          ))}
        </Section>
      )}

      {/* Status changer */}
      <StatusChanger submissionId={submission.id} currentStatus={status} />
    </div>
  );
}
