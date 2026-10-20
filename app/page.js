import Link from "next/link";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import { buttonClass } from "@/components/formStyles";

export default function Home() {
  const env = getPublicSupabaseEnv();

  return (
    <section className="rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-10">
      <p className="text-sm font-medium uppercase tracking-wide text-brand">Thesis prototype</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
        Sining Banwa event system
      </h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted">
        This first phase prepares the website and login. You can create an account, confirm your
        email, log in, and log out. Event listings, seats, and payments come in later phases.
      </p>
      {!env.configured ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Supabase is not connected yet. Add your project URL and keys to <code>.env.local</code>,
          then restart the dev server.
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/signup" className={buttonClass}>
          Create an account
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 font-medium hover:border-brand"
        >
          Log in
        </Link>
      </div>
    </section>
  );
}
