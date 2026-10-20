import Link from "next/link";
import { Suspense } from "react";
import { signUp } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass, fieldClass } from "@/components/formStyles";

export const metadata = {
  title: "Sign up | Sining Banwa",
};

export default function SignUpPage({ searchParams }) {
  return (
    <AuthCard
      title="Create an account"
      description="Supabase Auth stores the password. You must confirm the email before logging in."
    >
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      <form action={signUp} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium">
            Password
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
            Confirm password
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
          Sign up
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already confirmed?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
