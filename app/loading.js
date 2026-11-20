// Shown automatically by Next.js during any route navigation or redirect, on
// every page. Gives a visible loading state after a button redirects or a link
// is clicked.
export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-muted">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}