import { reservationStatusLabel } from "@/lib/reservationRules";

// Friendlier, customer-facing labels for the two review stages.
const CUSTOM_LABELS = {
  payment_verification: "Confirmation in progress",
  confirmed: "Verified",
};

const TONES = {
  awaiting_payment: "border-amber-200 bg-amber-50 text-amber-900",
  payment_verification: "border-blue-200 bg-blue-50 text-blue-900",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  rejected: "border-red-200 bg-red-50 text-red-900",
  pending: "border-line bg-card text-muted",
  cancelled: "border-line bg-card text-muted",
  expired: "border-line bg-card text-muted",
};

export function ReservationStatusBadge({ status, className = "" }) {
  const label = CUSTOM_LABELS[status] || reservationStatusLabel(status);
  const tone = TONES[status] || "border-line bg-card text-muted";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone} ${className}`}>
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}