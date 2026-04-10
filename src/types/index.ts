export type {
  User,
  Merchant,
  Address,
  BankAccount,
  Document,
  Contact,
  Role,
  MerchantStatus,
  OnboardingStatus,
  BusinessType,
  DocumentType,
  DocumentStatus,
  ContactType,
} from "@/generated/prisma/client";

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  path: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 0,
    title: "Business Information",
    description: "Tell us about your business",
    path: "/onboarding/business-info",
  },
  {
    id: 1,
    title: "Address",
    description: "Your business address",
    path: "/onboarding/address",
  },
  {
    id: 2,
    title: "Contact Person",
    description: "Primary contact information",
    path: "/onboarding/contact",
  },
  {
    id: 3,
    title: "Banking Details",
    description: "Payment and banking information",
    path: "/onboarding/banking",
  },
  {
    id: 4,
    title: "Documents",
    description: "Upload required documents",
    path: "/onboarding/documents",
  },
  {
    id: 5,
    title: "Review & Submit",
    description: "Review your application",
    path: "/onboarding/review",
  },
];
