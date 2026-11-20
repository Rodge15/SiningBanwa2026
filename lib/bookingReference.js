// A reservation's id is a UUID. The booking reference is a short, scannable
// code derived from it, e.g. "SB-1A2B3C4D". Because it is a pure function of the
// reservation id, the customer and the admin always see the SAME reference and
// the SAME barcode for a booking — they are synced by construction.
export function bookingReference(id) {
  return `SB-${String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}