import Link from "next/link";
import { Suspense } from "react";
import { BookingScanner } from "@/components/BookingScanner";
import { requireRole } from "@/lib/auth";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";

export const metadata = {
  title: "Scan tickets | Sining Banwa",
};

async function ScanDesk() {
  await requireRole(EVENT_MANAGER_ROLES);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Staff</p>
        <h1 className="mt-1 text-3xl font-semibold">Scan tickets at the entrance</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Point the camera at the booking barcode or QR code. A confirmed booking is admitted once —
          scanning it again shows that it was already used.
        </p>
      </div>
      <BookingScanner />
    </div>
  );
}

export default function ScanPage() {
  return (
    <section className="space-y-4">
      <Link href="/admin/payments" className="text-sm text-brand hover:underline">
        Back to payments
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Checking access...</p>}>
        <ScanDesk />
      </Suspense>
    </section>
  );
}