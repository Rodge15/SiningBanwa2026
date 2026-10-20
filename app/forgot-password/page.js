import Link from "next/link";
import { Suspense } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass, fieldClass } from "@/components/formStyles";

export const metadata = {
  title: "Forgot password | Sining Banwa",
};

export default function ForgotPasswordPage({ searchParams }) {
  return (
    <AuthCard
      title="Reset password"
      description="Supabase will email you a link. The link opens a page where you choose a new password."
    >
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      <form action={requestPasswordReset} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={fieldClass} />
        </div>
        <button type="submit" className={`${buttonClass} w-full`}>
          Send reset link
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        <Link href="/login" className="text-brand hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
}
