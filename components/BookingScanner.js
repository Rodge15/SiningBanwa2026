"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { admitBooking } from "@/app/actions/admission";

const OUTCOMES = {
  admitted: { tone: "border-emerald-300 bg-emerald-50 text-emerald-900", title: "Admitted ✓" },
  already_used: { tone: "border-red-300 bg-red-50 text-red-900", title: "Already used" },
  not_confirmed: { tone: "border-amber-300 bg-amber-50 text-amber-900", title: "Not confirmed yet" },
  not_found: { tone: "border-red-300 bg-red-50 text-red-900", title: "Booking not found" },
  ambiguous: { tone: "border-amber-300 bg-amber-50 text-amber-900", title: "Multiple matches" },
  invalid: { tone: "border-red-300 bg-red-50 text-red-900", title: "Unrecognized code" },
  error: { tone: "border-red-300 bg-red-50 text-red-900", title: "Something went wrong" },
};

function formatWhen(value) {
  if (!value) {
    return "";
  }
  try {
    return new Date(value).toLocaleString("en-PH");
  } catch {
    return "";
  }
}

export function BookingScanner() {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const handledRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState(null);
  const [pending, startTransition] = useTransition();

  function stopCamera() {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => {
    // Stop the camera if the page unmounts.
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, []);

  function handleCode(text) {
    if (!text) {
      return;
    }
    startTransition(async () => {
      const outcome = await admitBooking(text);
      setResult(outcome);
    });
  }

  async function startCamera() {
    setResult(null);
    setCameraError("");
    handledRef.current = false;

    try {
      const reader = new BrowserMultiFormatReader();
      // Prefer the rear camera for scanning at the entrance.
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (decoded) => {
          if (decoded && !handledRef.current) {
            handledRef.current = true;
            stopCamera();
            handleCode(decoded.getText());
          }
        },
      );
      controlsRef.current = controls;
      setScanning(true);
    } catch {
      setCameraError("Could not start the camera. Allow camera access, or type the reference below.");
      setScanning(false);
    }
  }

  function submitManual(event) {
    event.preventDefault();
    const value = manual.trim();
    if (value) {
      setResult(null);
      handleCode(value);
    }
  }

  function scanAgain() {
    setResult(null);
    setManual("");
    startCamera();
  }

  const meta = result ? OUTCOMES[result.outcome] || OUTCOMES.error : null;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-black">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      </div>

      <div className="flex flex-wrap gap-2">
        {scanning ? (
          <button
            type="button"
            onClick={stopCamera}
            className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 font-medium hover:border-brand"
          >
            Stop camera
          </button>
        ) : (
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark"
          >
            Start camera
          </button>
        )}
        {result ? (
          <button
            type="button"
            onClick={scanAgain}
            className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 font-medium hover:border-brand"
          >
            Scan next
          </button>
        ) : null}
      </div>

      {cameraError ? <p className="text-sm text-red-900">{cameraError}</p> : null}

      <form onSubmit={submitManual} className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-card p-4">
        <label className="flex-1 text-sm">
          <span className="text-muted">Or type the reference</span>
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="SB-1A2B3C4D"
            className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-foreground uppercase outline-none focus:border-brand"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          Check in
        </button>
      </form>

      {pending ? <p className="text-sm text-muted">Checking…</p> : null}

      {result && meta ? (
        <div className={`rounded-2xl border p-5 ${meta.tone}`}>
          <p className="text-lg font-semibold">{meta.title}</p>
          {result.outcome === "error" && result.message ? (
            <p className="mt-1 text-sm">{result.message}</p>
          ) : null}
          {result.reference ? (
            <p className="mt-2 font-mono text-sm">{result.reference}</p>
          ) : null}
          {result.eventTitle ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>
                <span className="font-medium">Event:</span> {result.eventTitle}
              </p>
              {result.customerName ? (
                <p>
                  <span className="font-medium">Customer:</span> {result.customerName}
                </p>
              ) : null}
              {typeof result.tickets === "number" ? (
                <p>
                  <span className="font-medium">Tickets:</span> {result.tickets}
                </p>
              ) : null}
              {result.outcome === "already_used" && result.admittedAt ? (
                <p>
                  <span className="font-medium">First scanned:</span> {formatWhen(result.admittedAt)}
                </p>
              ) : null}
              {result.outcome === "not_confirmed" && result.status ? (
                <p>
                  <span className="font-medium">Status:</span> {result.status}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}