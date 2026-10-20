import Link from "next/link";
import { Suspense } from "react";
import { updatePassword } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass, fieldClass } from "@/components/formStyles";

export const metadata = {
  title: "Choose a new password | Sining Banwa",
};

export default function ResetPasswordPage({ searchParams }) {
  return (
    <AuthCard
      title="Choose a new password"
      description="Open this page from the email link so Supabase can confirm it is your account."
    >
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      <form action={updatePassword} className="space-y-4">
        <div>
          <label htmlFor="password" className="text-sm font-medium">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={fieldClass}
          />
        </div>
        <button type="submit" className={`${buttonClass} w-full`}>
          Update password
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        <Link href="/forgot-password" className="text-brand hover:underline">
          Request a new link
        </Link>
      </p>
    </AuthCard>
  );
}
