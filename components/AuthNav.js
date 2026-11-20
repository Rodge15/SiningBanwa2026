import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { countPendingPayments } from "@/lib/paymentQueries";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export async function AuthNav() {
  const env = getPublicSupabaseEnv();

  if (!env.configured) {
    return <span className="text-sm text-muted">Supabase keys not set</span>;
  }

  let user = null;

  try {
    user = await getCurrentUser();
  } catch {
    return <span className="text-sm text-muted">Session unavailable</span>;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/login" className="hover:text-brand">
          Log in
        </Link>
        <Link href="/signup" className="rounded-lg bg-brand px-3 py-2 text-white hover:bg-brand-dark">
          Sign up
        </Link>
      </div>
    );
  }

  let profile = null;

  try {
    ({ profile } = await getCurrentProfile());
  } catch {
    profile = null;
  }

  const canManageEvents = Boolean(profile?.is_active && EVENT_MANAGER_ROLES.includes(profile.role));
  const pendingPayments = canManageEvents ? await countPendingPayments() : 0;
  const isAdmin = Boolean(profile?.is_active && profile.role === "administrator");

  return (
    <div className="flex items-center gap-3 text-sm">
      {canManageEvents ? (
        <>
          <Link href="/events/manage" className="hover:text-brand">
            Manage events
          </Link>
          <Link href="/admin/payments" className="flex items-center gap-1.5 hover:text-brand">
            Payments
            {pendingPayments > 0 ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                {pendingPayments}
              </span>
            ) : null}
          </Link>
          <Link href="/admin/bookings" className="hover:text-brand">
            Bookings
          </Link>
          <Link href="/admin/scan" className="hover:text-brand">
            Scan
          </Link>
        </>
      ) : null}
      {isAdmin ? (
        <Link href="/admin/users" className="hover:text-brand">
          Users
        </Link>
      ) : null}
      <Link href="/account/reservations" className="hover:text-brand">
        Reservations
      </Link>
      <Link href="/account" className="hover:text-brand">
        Dashboard
      </Link>
      <Link href="/account/profile" className="hover:text-brand">
        Settings
      </Link>
      <form action={signOut}>
        <button type="submit" className="hover:text-brand">
          Log out
        </button>
      </form>
    </div>
  );
}