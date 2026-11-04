import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cancelReservation } from "@/app/actions/reservations";
import { HoldCountdown } from "@/components/HoldCountdown";
import { PaymentProofForm } from "@/components/PaymentProofForm";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { formatManilaDateTime, isUuid } from "@/lib/eventRules";
import { formatPeso } from "@/lib/seatRules";
import { getPaymentSettings, listReservationPayments } from "@/lib/paymentQueries";
import { paymentMethodLabel } from "@/lib/paymentRules";
import { getMyReservation, isMissingReservationSetup, reservationSetupMessage } from "@/lib/reservations";
import { reservationSourceLabel, reservationStatusLabel, totalsMatch } from "@/lib/reservationRules";
import { ROLES } from "@/lib/roles";

export const metadata = {
  title: "Reservation | Sining Banwa",
};

async function ReservationDetails({ params, searchParams }) {
  const { user } = await requireRole(ROLES);
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const { data, error } = await getMyReservation(user.id, id);

  if (error) {
    return (
      <p className="text-sm text-red-900">
        {isMissingReservationSetup(error) ? reservationSetupMessage() : "This reservation could not be loaded."}
      </p>
    );
  }

  if (!data) {
    notFound();
  }

  const payments = data.source === "online" ? await listReservationPayments(data.id) : { data: [], error: null };
  const settings = data.source === "online" ? await getPaymentSettings() : { data: null, error: null };
  const latest = payments.data[0];
  const canPay = data.source === "online" && (data.status === "awaiting_payment" || data.status === "rejected");
  const canCancel = data.source === "online" && (data.status === "awaiting_payment" || data.status === "rejected") && latest?.status !== "pending";
  const pricesMatch = data.ticketQuantity > 0 || totalsMatch(data.totalAmount, data.items);

  return (
    <article className="space-y-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Reservation</p>
        <h1 className="mt-1 text-3xl font-semibold">{data.eventTitle}</h1>
        <p className="mt-2 text-sm text-muted">
          {reservationStatusLabel(data.status)} · {reservationSourceLabel(data.source)} ·{" "}
          {formatManilaDateTime(data.createdAt)}
          {data.showingStartsAt ? ` · Showing ${formatManilaDateTime(data.showingStartsAt)}` : ""}
        </p>
      </div>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      {canCancel && data.holdExpiresAt ? <HoldCountdown expiresAt={data.holdExpiresAt} /> : null}
      {data.ticketQuantity > 0 ? <p className="text-sm">Tickets: {data.ticketQuantity}</p> : null}
      <ul className="space-y-1 text-sm">
        {data.items.map((item) => (
          <li key={item.id}>
            Seat {item.seatLabel} · {formatPeso(item.unitPrice)}
            {item.releasedAt ? " · released" : ""}
          </li>
        ))}
      </ul>
      <p className="font-medium">Total {formatPeso(data.totalAmount)}</p>
      {pricesMatch ? (
        <p className="text-sm text-muted">This total is the sum of the seat prices saved when the hold was created.</p>
      ) : (
        <p className="text-sm text-red-900">The stored total does not match the seat prices on this reservation.</p>
      )}
      {data.status === "confirmed" && latest?.status === "verified" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">Payment confirmed.</p>
      ) : null}
      {data.status === "payment_verification" ? (
        <p className="text-sm text-muted">Payment submitted. Your seats stay held while staff review the screenshot.</p>
      ) : null}
      {data.status === "rejected" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Payment rejected.{latest?.rejection_note ? ` ${latest.rejection_note}` : ""} You can resubmit before the hold ends.
        </p>
      ) : null}
      {canPay && settings.data ? (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap text-sm">{settings.data.instructions}</p>
          {settings.data.qr_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/payments/qr" alt="Payment QR code" className="h-48 w-48 rounded-lg border border-line object-contain" />
          ) : (
            <p className="text-sm text-muted">The administrator has not uploaded a payment QR code yet.</p>
          )}
          <PaymentProofForm reservationId={data.id} amountLabel={formatPeso(data.totalAmount)} resubmit={data.status === "rejected"} />
        </div>
      ) : null}
      {latest ? (
        <p className="text-sm text-muted">
          Latest proof: {paymentMethodLabel(latest.method)} · {latest.reference_number}
          {latest.verified_by_name ? ` · checked by ${latest.verified_by_name}` : ""}
          {" · "}
          <a href={`/payments/proof/${latest.id}`} className="text-brand hover:underline">View screenshot</a>
        </p>
      ) : null}
      {canCancel ? (
        <form action={cancelReservation}>
          <input type="hidden" name="reservationId" value={data.id} />
          <button type="submit" className={buttonClass}>
            Cancel hold
          </button>
        </form>
      ) : null}
      <p>
        <Link href={`/events/${data.eventId}`} className="text-sm text-brand hover:underline">
          View event
        </Link>
      </p>
    </article>
  );
}

export default function ReservationPage({ params, searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/account/reservations" className="text-sm text-brand hover:underline">
        Back to my reservations
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading reservation...</p>}>
        <ReservationDetails params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
