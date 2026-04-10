export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusChanger } from "@/components/dashboard/StatusChanger";

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
      <dt className="text-sm text-gray-500 sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 font-medium break-all">{value ?? <span className="text-gray-400 font-normal">—</span>}</dd>
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

export default async function MerchantPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: { contacts: true },
  });

  if (!merchant) notFound();

  const status = merchant.status as Status;
  const primaryContact = merchant.contacts.find((c) => c.isPrimary) ?? merchant.contacts[0];

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
          {merchant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={merchant.logoUrl} alt="logo" className="w-10 h-10 rounded-lg object-contain border border-gray-200" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{merchant.businessName}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {/* About the Project */}
      <Section title="About the Project">
        <InfoRow label="Project name" value={merchant.businessName} />
        <InfoRow
          label="Website"
          value={
            merchant.website ? (
              <a href={merchant.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {merchant.website}
              </a>
            ) : null
          }
        />
        <InfoRow
          label="Payment URLs"
          value={
            merchant.paymentUrls.length > 0 ? (
              <ul className="space-y-1">
                {merchant.paymentUrls.map((url, i) => (
                  <li key={i}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null
          }
        />
        <InfoRow label="Services provided" value={merchant.servicesProvided} />
      </Section>

      {/* Contacts */}
      <Section title="Contacts">
        {primaryContact ? (
          <>
            <InfoRow label="Name" value={`${primaryContact.firstName} ${primaryContact.lastName}`} />
            <InfoRow
              label="Email"
              value={
                <a href={`mailto:${primaryContact.email}`} className="text-blue-600 hover:underline">
                  {primaryContact.email}
                </a>
              }
            />
            <InfoRow label="Telegram" value={primaryContact.telegram} />
          </>
        ) : (
          <p className="text-sm text-gray-400">No contact information</p>
        )}
      </Section>

      {/* Business Profile */}
      <Section title="Business Profile">
        <InfoRow label="Project age" value={merchant.projectAge} />
        <InfoRow
          label="Chargeback rate"
          value={merchant.chargebackRate != null ? `${merchant.chargebackRate}%` : null}
        />
        <InfoRow
          label="Refund rate"
          value={merchant.refundRate != null ? `${merchant.refundRate}%` : null}
        />
      </Section>

      {/* Documents */}
      <Section title="Documents">
        <InfoRow
          label="Privacy Policy"
          value={
            merchant.privacyPolicyUrl ? (
              <a href={merchant.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {merchant.privacyPolicyUrl}
              </a>
            ) : null
          }
        />
        <InfoRow
          label="Terms of Service"
          value={
            merchant.termsUrl ? (
              <a href={merchant.termsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {merchant.termsUrl}
              </a>
            ) : null
          }
        />
        <InfoRow
          label="Refund Policy"
          value={
            merchant.refundPolicyUrl ? (
              <a href={merchant.refundPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {merchant.refundPolicyUrl}
              </a>
            ) : null
          }
        />
        {merchant.noLegalDocs && (
          <InfoRow label="Legal docs" value={<span className="text-amber-600">No legal documents available</span>} />
        )}
        {merchant.logoUrl && (
          <InfoRow
            label="Logo"
            value={
              <a href={merchant.logoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                View logo
              </a>
            }
          />
        )}
      </Section>

      {/* Status changer */}
      <StatusChanger merchantId={merchant.id} currentStatus={status} />
    </div>
  );
}
