import Link from "next/link";
import { Suspense } from "react";
import { AuthNav } from "@/components/AuthNav";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-lg font-semibold text-brand">
            Sining Banwa
          </Link>
          <p className="text-xs text-muted">Albay arts events</p>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:text-brand">
            Home
          </Link>
          <Suspense fallback={<span className="text-muted">Checking session...</span>}>
            <AuthNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
