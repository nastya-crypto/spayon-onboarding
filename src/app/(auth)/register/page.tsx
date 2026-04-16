import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Register | Spayon Onboarding",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-8 bg-white rounded-xl shadow-lg text-center">
        <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Registration by invite only</h2>
          <p className="mt-2 text-sm text-gray-600">
            To register, please contact your manager to receive a personal onboarding link.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm text-blue-600 hover:underline font-medium"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
