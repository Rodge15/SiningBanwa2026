import { buttonClass, fieldClass } from "@/components/formStyles";
import { submitPaymentProof } from "@/app/actions/payments";

export function PaymentProofForm({ reservationId, amountLabel, resubmit = false }) {
  return (
    <form action={submitPaymentProof} className="space-y-3 rounded-xl border border-line p-4">
      <h2 className="text-lg font-semibold">{resubmit ? "Submit payment again" : "I've paid"}</h2>
      <p className="text-sm text-muted">
        Pay {amountLabel} using the QR code, then enter the reference and upload a screenshot. A staff member checks it. This is not automatic.
      </p>
      <input type="hidden" name="reservationId" value={reservationId} />
      <label className="block text-sm font-medium" htmlFor="method">
        Method
        <select id="method" name="method" className={fieldClass} defaultValue="gcash">
          <option value="gcash">GCash</option>
          <option value="bank">Bank transfer</option>
        </select>
      </label>
      <label className="block text-sm font-medium" htmlFor="reference">
        Payment reference number
        <input id="reference" name="reference" required minLength={4} maxLength={40} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium" htmlFor="proof">
        Screenshot (JPG, PNG, or WebP, up to 5 MiB)
        <input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp" required className={fieldClass} />
      </label>
      <button type="submit" className={buttonClass}>
        {resubmit ? "Resubmit payment" : "I've paid"}
      </button>
    </form>
  );
}
