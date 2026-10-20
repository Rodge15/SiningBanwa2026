import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass } from "@/components/formStyles";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Account | Sining Banwa",
};

async function AccountDetails({ searchParams }) {
  const user = await requireUser();

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Your account</h1>
      <p className="mt-2 text-sm text-muted">This page is protected by the server-side session check.</p>
      <Suspense fallback={null}>
        <div className="mt-4">
          <QueryMessage searchParams={searchParams} />
        </div>
      </Suspense>
      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div>
          <dt className="text-muted">Email confirmed</dt>
          <dd className="font-medium">{user.email_confirmed_at ? "Yes" : "Not yet"}</dd>
        </div>
      </dl>
      <form action={signOut} className="mt-6">
        <button type="submit" className={buttonClass}>
          Log out
        </button>
      </form>
    </section>
  );
}

export default function AccountPage({ searchParams }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Checking your session...</p>}>
      <AccountDetails searchParams={searchParams} />
    </Suspense>
  );
}
