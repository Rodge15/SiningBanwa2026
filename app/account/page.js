import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { ADMIN_ROLES, EVENT_MANAGER_ROLES, ROLES, roleLabel } from "@/lib/roles";

export const metadata = {
  title: "Dashboard | Sining Banwa",
};

async function Dashboard({ searchParams }) {
  const { user, profile } = await requireRole(ROLES);
  const canManageEvents = EVENT_MANAGER_ROLES.includes(profile.role);
  const isAdmin = ADMIN_ROLES.includes(profile.role);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Dashboard</p>
        <h1 className="mt-1 text-3xl font-semibold">Hello, {profile.full_name || "there"}</h1>
        <p className="mt-2 text-sm text-muted">
          {roleLabel(profile.role)} · {profile.email || user.email}
        </p>
      </div>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/events" className="rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-brand">
          <h2 className="font-semibold">Published events</h2>
          <p className="mt-2 text-sm text-muted">Browse events that are open to the public.</p>
        </Link>
        <Link
          href="/account/reservations"
          className="rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-brand"
        >
          <h2 className="font-semibold">My reservations</h2>
          <p className="mt-2 text-sm text-muted">See seats you are holding and the saved total.</p>
        </Link>
        <Link
          href="/account/profile"
          className="rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-brand"
        >
          <h2 className="font-semibold">Profile</h2>
          <p className="mt-2 text-sm text-muted">Update your name and phone, or change your password.</p>
        </Link>
        {canManageEvents ? (
          <Link
            href="/events/manage"
            className="rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-brand"
          >
            <h2 className="font-semibold">Manage events</h2>
            <p className="mt-2 text-sm text-muted">Create and edit events. Customers cannot open this.</p>
          </Link>
        ) : null}
        {isAdmin ? (
          <Link
            href="/admin/users"
            className="rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-brand"
          >
            <h2 className="font-semibold">Users</h2>
            <p className="mt-2 text-sm text-muted">Change roles, switch accounts off, or download contacts.</p>
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-muted">Payments and tickets are later phases.</p>
      <form action={signOut}>
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
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
