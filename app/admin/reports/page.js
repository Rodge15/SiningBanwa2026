import { connection } from "next/server";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { getReportsOverview } from "@/lib/reportQueries";
import { reservationStatusLabel } from "@/lib/reservationRules";
import { ADMIN_ROLES } from "@/lib/roles";

export const metadata = {
  title: "Reports | Sining Banwa",
};

const RESERVATION_STATUS_ORDER = [
  "pending",
  "awaiting_payment",
  "payment_verification",
  "confirmed",
  "rejected",
  "cancelled",
  "expired",
];

function paymentLabel(status) {
  if (status === "verified") {
    return "Verified";
  }
  if (status === "rejected") {
    return "Rejected";
  }
  if (status === "pending") {
    return "Pending";
  }
  return status;
}

async function Reports() {
  await requireRole(ADMIN_ROLES);
  await connection();

  const report = await getReportsOverview();
  const confirmed = report.statusCounts.confirmed || 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Admin</p>
        <h1 className="mt-1 text-3xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-muted">An overview of bookings, payments, and attendance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total bookings</p>
          <p className="mt-1 text-2xl font-semibold">{report.totalReservations}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted">Confirmed</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{confirmed}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted">Admitted</p>
          <p className="mt-1 text-2xl font-semibold">{report.admitted}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted">Payments to review</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{report.paymentCounts.pending || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Bookings by status</h2>
          <ul className="space-y-2 text-sm">
            {RESERVATION_STATUS_ORDER.filter((status) => report.statusCounts[status]).map((status) => (
              <li key={status} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
                <span className="text-muted">{reservationStatusLabel(status)}</span>
                <span className="font-semibold">{report.statusCounts[status]}</span>
              </li>
            ))}
            {Object.keys(report.statusCounts).length === 0 ? (
              <li className="text-muted">No bookings yet.</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-card p-6">
          <h2 className="mb-3 text-lg font-semibold">Payments</h2>
          <ul className="space-y-2 text-sm">
            {["verified", "pending", "rejected"]
              .filter((status) => report.paymentCounts[status])
              .map((status) => (
                <li key={status} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
                  <span className="text-muted">{paymentLabel(status)}</span>
                  <span className="font-semibold">{report.paymentCounts[status]}</span>
                </li>
              ))}
            {Object.keys(report.paymentCounts).length === 0 ? (
              <li className="text-muted">No payments yet.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Top events by confirmed bookings</h2>
        {report.topEvents.length === 0 ? (
          <p className="text-sm text-muted">No confirmed bookings yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {report.topEvents.map((event) => (
              <li key={event.title} className="flex items-center justify-between border-b border-line pb-2 last:border-0">
                <span>{event.title}</span>
                <span className="font-semibold">{event.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading reports...</p>}>
      <Reports />
    </Suspense>
  );
}