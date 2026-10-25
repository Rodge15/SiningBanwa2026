import Link from "next/link";
import { Suspense } from "react";
import { QueryMessage } from "@/components/QueryMessage";
import { requireRole } from "@/lib/auth";
import { formatManilaDateTime } from "@/lib/eventRules";
import { formatPeso } from "@/lib/seatRules";
import { isMissingReservationSetup, listMyReservations, reservationSetupMessage } from "@/lib/reservations";
import { reservationStatusLabel } from "@/lib/reservationRules";
import { ROLES } from "@/lib/roles";

export const metadata = {
  title: "My reservations | Sining Banwa",
};

async function ReservationList({ searchParams }) {
  const { user } = await requireRole(ROLES);
  const { data, error } = await listMyReservations(user.id);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Customer</p>
        <h1 className="mt-1 text-3xl font-semibold">My reservations</h1>
        <p className="mt-2 text-sm text-muted">These are holds you created. Payment and tickets are later steps.</p>
      </div>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      {error ? (
        <p className="text-sm text-red-900">
          {isMissingReservationSetup(error) ? reservationSetupMessage() : "Reservations could not be loaded."}
        </p>
      ) : null}
      {!error && data.length === 0 ? <p className="text-sm text-muted">You have no reservations yet.</p> : null}
      <ul className="space-y-3">
        {(data || []).map((reservation) => (
          <li key={reservation.id}>
            <Link
              href={`/account/reservations/${reservation.id}`}
              className="block rounded-2xl border border-line bg-card p-4 shadow-sm hover:border-brand"
            >
              <span className="font-semibold">{reservation.eventTitle}</span>
              <span className="mt-1 block text-sm text-muted">
                {reservationStatusLabel(reservation.status)} · {formatPeso(reservation.totalAmount)} ·{" "}
                {formatManilaDateTime(reservation.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ReservationsPage({ searchParams }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading reservations...</p>}>
      <ReservationList searchParams={searchParams} />
    </Suspense>
  );
}
