import Link from "next/link";
import { Suspense } from "react";
import { reviewPayment, savePaymentSettings } from "@/app/actions/payments";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass, fieldClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Staff</p>
        <h1 className="mt-1 text-3xl font-semibold">Payments waiting for review</h1>
        <p className="mt-2 text-sm text-muted">
          Check the reference and screenshot yourself. The system does not verify GCash or the bank.
        </p>
      </div>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      {setupError ? (
        <p className="text-sm text-red-900">
          {isMissingShowingSetup(setupError) ? showingSetupMessage() : "Payments could not be loaded."}
        </p>
      ) : null}
      <section className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-lg font-semibold">QR code and instructions</h2>
        <p className="mt-2 text-sm text-muted">Customers see this static QR after they hold seats. Upload your GCash or bank QR image.</p>
        {settings.data?.qr_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/payments/qr" alt="Payment QR code" className="mt-4 h-48 w-48 rounded-lg border border-line object-contain" />
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
            <input id="qr" name="qr" type="file" accept="image/jpeg,image/png,image/webp" className={fieldClass} />
          </label>
          <button type="submit" className={buttonClass}>Save payment instructions</button>
        </form>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Waiting ({pending.data.length})</h2>
        {pending.data.length === 0 ? <p className="text-sm text-muted">No payments are waiting.</p> : null}
        {pending.data.map((payment) => (
          <article key={payment.id} className="rounded-2xl border border-line bg-card p-4">
            <p className="font-medium">{formatPeso(payment.amount)} · {paymentMethodLabel(payment.method)}</p>
            <p className="mt-1 text-sm text-muted">Reference {payment.reference_number}</p>
            <p className="text-sm text-muted">Submitted {formatManilaDateTime(payment.submitted_at)}</p>
            <p className="mt-2">
              <a href={`/payments/proof/${payment.id}`} className="text-sm text-brand hover:underline">View screenshot</a>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={reviewPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="decision" value="verified" />
                <button type="submit" className={buttonClass}>Approve</button>
              </form>
              <form action={reviewPayment} className="flex flex-wrap gap-2">
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="decision" value="rejected" />
                <input name="note" placeholder="Reason (optional)" className={fieldClass} maxLength={200} />
                <button type="submit" className="rounded-lg border border-line px-4 py-2 text-sm">Reject</button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default function PaymentsPage({ searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/events/manage" className="text-sm text-brand hover:underline">Back to managed events</Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading payments...</p>}>
        <PaymentDesk searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
