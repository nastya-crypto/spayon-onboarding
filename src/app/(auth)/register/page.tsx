import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register | Spayon Onboarding",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 text-center">Create account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Start your merchant onboarding journey
          </p>
        </div>
        {/* RegisterForm component will go here */}
      </div>
    </div>
  );
}
