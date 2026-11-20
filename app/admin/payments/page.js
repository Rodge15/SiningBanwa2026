import Link from "next/link";
import { Suspense } from "react";
import { reviewPayment, savePaymentSettings } from "@/app/actions/payments";
import { Barcode } from "@/components/Barcode";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass, fieldClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { bookingReference } from "@/lib/bookingReference";
import { formatManilaDateTime } from "@/lib/eventRules";
import { getPaymentSettings, listPendingPayments } from "@/lib/paymentQueries";
import { paymentMethodLabel } from "@/lib/paymentRules";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { formatPeso } from "@/lib/seatRules";
import { isMissingShowingSetup, showingSetupMessage } from "@/lib/showings";

export const metadata = {
  title: "Payment review | Sining Banwa",
};

async function PaymentDesk({ searchParams }) {
  await requireRole(EVENT_MANAGER_ROLES);
  const settings = await getPaymentSettings();
  const pending = await listPendingPayments();
  const setupError = settings.error || pending.error;
  const waiting = pending.data || [];
  const count = waiting.length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Staff</p>
        <h1 className="mt-1 text-3xl font-semibold">Payment review</h1>
        <p className="mt-2 text-sm text-muted">
          Customers who booked and paid show up here. Check the reference and screenshot yourself —
          the system does not verify GCash or the bank.
        </p>
      </div>

      {/* Top-of-page notice so paid bookings are impossible to miss. */}
      {count > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
            {count}
          </span>
          <p className="text-sm font-medium text-amber-900">
            {count === 1 ? "1 payment is" : `${count} payments are`} waiting for your review.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          You&apos;re all caught up — no payments are waiting.
        </div>
      )}

      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>

      {setupError ? (
        <p className="text-sm text-red-900">
          {isMissingShowingSetup(setupError) ? showingSetupMessage() : "Payments could not be loaded."}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Waiting for review <span className="text-muted">({count})</span>
        </h2>

        {count === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
            Nothing to review right now. New paid bookings will appear here automatically.
          </p>
        ) : null}

        {waiting.map((payment) => {
          const reference = bookingReference(payment.reservation_id);

          return (
            <article key={payment.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Waiting for review
                    </span>
                    <span className="text-xs text-muted">
                      Submitted {formatManilaDateTime(payment.submitted_at)}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-brand">
                    Booking reference
                  </p>
                  <p className="font-mono text-xl font-semibold tracking-wider">{reference}</p>

                  <p className="mt-2 text-lg font-semibold">
                    {formatPeso(payment.amount)} · {paymentMethodLabel(payment.method)}
                  </p>
                  <p className="text-sm text-muted">
                    Payment ref from customer:{" "}
                    <span className="font-mono text-foreground">{payment.reference_number}</span>
                  </p>
                  <p className="mt-2">
                    <a
                      href={`/payments/proof/${payment.id}`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      View payment screenshot
                    </a>
                  </p>
                </div>

                {/* Same barcode and number the customer carries — scan to match. */}
                <div className="rounded-lg border border-line bg-white p-2 sm:w-56">
                  <Barcode value={reference} height={48} className="w-full" />
                  <p className="mt-1 text-center font-mono text-xs tracking-[0.2em] text-stone-800">
                    {reference}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <form action={reviewPayment}>
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <input type="hidden" name="decision" value="verified" />
                  <button type="submit" className={buttonClass}>
                    Approve
                  </button>
                </form>
                <form action={reviewPayment} className="flex flex-1 flex-wrap items-center gap-2">
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <input
                    name="note"
                    placeholder="Reason for rejecting (optional)"
                    className={`${fieldClass} flex-1 sm:max-w-xs`}
                    maxLength={200}
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:border-brand"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-lg font-semibold">Payment QR and instructions</h2>
        <p className="mt-2 text-sm text-muted">
          Customers see this static QR after they hold seats. Upload your GCash or bank QR image.
        </p>
        {settings.data?.qr_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/payments/qr"
            alt="Payment QR code"
            className="mt-4 h-48 w-48 rounded-lg border border-line object-contain"
          />
        ) : (
          <p className="mt-4 text-sm text-muted">No QR code has been uploaded yet.</p>
        )}
        <form action={savePaymentSettings} className="mt-4 space-y-3">
          <label className="block text-sm font-medium" htmlFor="instructions">
            Instructions
            <textarea
              id="instructions"
              name="instructions"
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              defaultValue={settings.data?.instructions || ""}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-medium" htmlFor="qr">
            Replace QR image (JPG, PNG, or WebP, up to 5 MiB)
            <input
              id="qr"
              name="qr"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={fieldClass}
            />
          </label>
          <button type="submit" className={buttonClass}>
            Save payment instructions
          </button>
        </form>
      </section>
    </div>
  );
}

export default function PaymentsPage({ searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/events/manage" className="text-sm text-brand hover:underline">
        Back to managed events
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading payments...</p>}>
        <PaymentDesk searchParams={searchParams} />
      </Suspense>
    </section>
  );
}