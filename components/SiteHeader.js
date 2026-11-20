import Link from "next/link";
import { Suspense } from "react";
import { AuthNav } from "@/components/AuthNav";
import { HeaderNav } from "@/components/HeaderNav";
import { Logo } from "@/components/Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
      <div className="relative mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/">
          <Logo />
        </Link>
        <HeaderNav
          auth={
            <Suspense fallback={<span className="text-sm text-muted">...</span>}>
              <AuthNav />
            </Suspense>
          }
        />
      </div>
    </header>
  );
}