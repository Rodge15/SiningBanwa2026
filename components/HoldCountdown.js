"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function remainingParts(expiresAt, now) {
  const remaining = new Date(expiresAt).getTime() - now;

  if (!Number.isFinite(remaining) || remaining <= 0) {
    return null;
  }

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function HoldCountdown({ expiresAt }) {
  const router = useRouter();
  const refreshed = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const label = remainingParts(expiresAt, now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (label || refreshed.current) {
      return;
    }

    refreshed.current = true;
    router.refresh();
  }, [label, router]);

  if (!label) {
    return (
      <p className="text-sm text-muted">
        The hold time is over. This page checks the database again. Payment is not part of this step, so these seats
        are released for other customers.
      </p>
    );
  }

  return <p className="text-sm">Seats stay on hold for {label}. Payment is not part of this step.</p>;
}
