import Link from "next/link";
import { Suspense } from "react";
import { bookingReference } from "@/lib/bookingReference";
import { requireRole } from "@/lib/auth";
import { formatManilaDateTime } from "@/lib/eventRules";
import { listConfirmedReservations } from "@/lib/paymentQueries";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { formatPeso } from "@/lib/seatRules";

export const metadata = {
  title: "Approved bookings | Sining Banwa",
};

function ticketCount(row) {
  return row.ticket_quantity && row.ticket_quantity > 0 ? row.ticket_quantity : 1;
}

async function BookingsList() {
  await requireRole(EVENT_MANAGER_ROLES);
  const { data, error } = await listConfirmedReservations();
  const rows = data || [];
  const admitted = rows.filter((row) => row.admitted_at).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Staff</p>
        <h1 className="mt-1 text-3xl font-semibold">Approved bookings</h1>
        <p className="mt-2 text-sm text-muted">
          Every booking you confirmed. Scanning a barcode at the entrance marks it admitted.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-line bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">Approved</p>
          <p className="mt-0.5 text-2xl font-semibold">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">Admitted</p>
          <p className="mt-0.5 text-2xl font-semibold text-emerald-600">{admitted}</p>
        </div>
        <div className="rounded-xl border border-line bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">Not yet in</p>
          <p className="mt-0.5 text-2xl font-semibold text-stone-500">{rows.length - admitted}</p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Approved bookings could not be loaded.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-background/40 text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Tickets</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Approved</th>
              <th className="px-4 py-3 font-medium">Admission</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  No approved bookings yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const name = row.customer_name || row.profiles?.full_name || row.profiles?.email || "Customer";
                return (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-medium">
                      {bookingReference(row.id)}
                    </td>
                    <td className="px-4 py-3">{row.event_title}</td>
                    <td className="px-4 py-3">{name}</td>
                    <td className="px-4 py-3">{ticketCount(row)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatPeso(row.total_amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatManilaDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {row.admitted_at ? (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          Admitted
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-stone-200 bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                          Not yet
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ApprovedBookingsPage() {
  return (
    <section className="space-y-4">
      <Link href="/admin/payments" className="text-sm text-brand hover:underline">
        Back to payments
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading approved bookings...</p>}>
        <BookingsList />
      </Suspense>
    </section>
  );
}