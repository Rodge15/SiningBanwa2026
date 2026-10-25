import Link from "next/link";
import { Suspense } from "react";
import { signIn } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass, fieldClass } from "@/components/formStyles";

export const metadata = {
  title: "Log in | Sining Banwa",
};

export default async function LoginPage({ searchParams }) {
  const query = await searchParams;
  const next = typeof query.next === "string" ? query.next : "";

  return (
    <AuthCard
      title="Log in"
      description="Use the email and password from your Supabase account."
    >
      <Suspense fallback={null}>
        <QueryMessage searchParams={Promise.resolve(query)} />
      </Suspense>
      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
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
            autoComplete="current-password"
            required
            className={fieldClass}
          />
        </div>
        <button type="submit" className={`${buttonClass} w-full`}>
          Log in
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        <Link href="/forgot-password" className="text-brand hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="mt-2 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
