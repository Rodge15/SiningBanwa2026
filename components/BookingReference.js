"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Barcode } from "@/components/Barcode";
import { bookingReference } from "@/lib/bookingReference";

// Re-exported so existing imports from this module keep working.
export { bookingReference };

export function BookingReference({ reservationId }) {
  const [qr, setQr] = useState("");
  const reference = bookingReference(reservationId);

  useEffect(() => {
    const url = `${window.location.origin}/account/reservations/${reservationId}`;
    QRCode.toDataURL(url, { margin: 1, width: 200 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [reservationId]);

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt={`QR code for booking ${reference}`}
            className="h-36 w-36 rounded-lg border border-line"
          />
        ) : (
          <div className="flex h-36 w-36 items-center justify-center rounded-lg border border-dashed border-line text-xs text-muted">
            Generating code...
          </div>
        )}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand">Booking reference</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-wider">{reference}</p>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Keep this reference. Show it at the entrance &mdash; staff can scan the QR or the barcode
            to pull up your booking.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-3">
        <Barcode value={reference} height={60} className="w-full" />
        <p className="mt-1 text-center font-mono text-sm tracking-[0.3em] text-stone-800">
          {reference}
        </p>
      </div>
    </div>
  );
}