import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { DonutChart } from "@/components/DonutChart";
import { QueryMessage } from "@/components/QueryMessage";
import { requireRole } from "@/lib/auth";
import { getManagerDashboardStats } from "@/lib/dashboardQueries";
import { listMyReservations } from "@/lib/reservations";
import { ADMIN_ROLES, EVENT_MANAGER_ROLES, ROLES, roleLabel } from "@/lib/roles";
import { formatPeso } from "@/lib/seatRules";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = {
  title: "Dashboard | Sining Banwa",
};

const RES_STATUS_META = {
  confirmed: { label: "Confirmed", color: "#059669" },
  payment_verification: { label: "In review", color: "#2563eb" },
  awaiting_payment: { label: "Awaiting payment", color: "#d97706" },
  pending: { label: "Pending", color: "#9ca3af" },
  rejected: { label: "Rejected", color: "#dc2626" },
  cancelled: { label: "Cancelled", color: "#6b7280" },
  expired: { label: "Expired", color: "#b8b2ac" },
};

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const quickCardClass = "rounded-2xl border border-line bg-card p-5 shadow-sm hover:border-brand";

async function Dashboard({ searchParams }) {
  await connection();
  const { user, profile } = await requireRole(ROLES);
  const canManageEvents = EVENT_MANAGER_ROLES.includes(profile.role);
  const isAdmin = ADMIN_ROLES.includes(profile.role);

  const stats = canManageEvents ? await getManagerDashboardStats() : null;
  const myReservations = canManageEvents ? { data: [] } : await listMyReservations(user.id);
  const myRows = myReservations.data || [];
  const myActive = myRows.filter((row) => row.status === "awaiting_payment" || row.status === "payment_verification").length;
  const myConfirmed = myRows.filter((row) => row.status === "confirmed").length;

  const donutData = stats
    ? Object.entries(stats.reservationStatus).map(([status, value]) => ({
        label: RES_STATUS_META[status]?.label || status,
        value,
        color: RES_STATUS_META[status]?.color || "#9ca3af",
      }))
    : [];

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold">Hello, {profile.full_name || "there"}</h1>
          <p className="mt-2 text-sm text-muted">
            {roleLabel(profile.role)} · {profile.email || user.email}
          </p>
        </div>
        <form action={signOut}>
          <SubmitButton base="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-brand">
  Log out
</SubmitButton>
        </form>
      </div>

      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>

      {canManageEvents ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Overview</h2>
          {stats ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total revenue" value={formatPeso(stats.revenue)} hint="Verified payments" />
                <StatCard label="Total bookings" value={stats.totalBookings} hint="All reservations" />
                <StatCard
                  label="Payments to review"
                  value={stats.pendingPayments}
                  hint={stats.pendingPayments > 0 ? "Needs action" : "All clear"}
                />
                <StatCard label="Published events" value={stats.publishedEvents} hint={`${stats.totalEvents} total`} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                  <h3 className="font-semibold">Reservations by status</h3>
                  <div className="mt-4">
                    <DonutChart data={donutData} />
                  </div>
                </div>
                <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                  <h3 className="font-semibold">Seats</h3>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex justify-between"><span>Sold (paid)</span><span className="font-medium">{stats.seats.sold}</span></li>
                    <li className="flex justify-between"><span>Held / awaiting</span><span className="font-medium">{stats.seats.held}</span></li>
                    <li className="flex justify-between"><span>Available</span><span className="font-medium">{stats.seats.available}</span></li>
                    <li className="flex justify-between"><span>Blocked</span><span className="font-medium">{stats.seats.blocked}</span></li>
                    <li className="flex justify-between border-t border-line pt-2">
                      <span>Total seats</span>
                      <span className="font-medium">{stats.seats.total}</span>
                    </li>
                  </ul>
                </div>
              </div>
              <p className="rounded-xl border border-dashed border-line bg-card px-4 py-3 text-xs text-muted">
                &quot;Total revenue&quot; is money from verified payments. Cost and profit need an expense-tracking feature,
                which is not set up yet &mdash; ask to add it to see real cost and profit here.
              </p>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-line bg-card px-4 py-6 text-sm text-muted">
              Stats need the service role key in <code>.env.local</code> on the server to read totals.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Active holds" value={myActive} hint="Awaiting payment or review" />
          <StatCard label="Confirmed bookings" value={myConfirmed} hint="Verified by staff" />
          <StatCard label="Total reservations" value={myRows.length} />
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/events" className={quickCardClass}>
            <h3 className="font-semibold">Published events</h3>
            <p className="mt-2 text-sm text-muted">Browse events open to the public.</p>
          </Link>
          <Link href="/account/reservations" className={quickCardClass}>
            <h3 className="font-semibold">My reservations</h3>
            <p className="mt-2 text-sm text-muted">Seats you are holding and your booking status.</p>
          </Link>
          <Link href="/account/profile" className={quickCardClass}>
            <h3 className="font-semibold">Profile</h3>
            <p className="mt-2 text-sm text-muted">Update your name and phone, or change your password.</p>
          </Link>
          {canManageEvents ? (
            <>
              <Link href="/events/manage" className={quickCardClass}>
                <h3 className="font-semibold">Manage events</h3>
                <p className="mt-2 text-sm text-muted">Create, edit, publish, and delete events.</p>
              </Link>
              <Link href="/admin/payments" className={quickCardClass}>
                <h3 className="font-semibold">Payments</h3>
                <p className="mt-2 text-sm text-muted">Review and verify payment submissions.</p>
              </Link>
            </>
          ) : null}
          {isAdmin ? (
            <Link href="/admin/users" className={quickCardClass}>
              <h3 className="font-semibold">Users</h3>
              <p className="mt-2 text-sm text-muted">Change roles, deactivate accounts, download contacts.</p>
            </Link>
          ) : null}
        </div>
      </div>
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