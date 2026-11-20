"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const LINKS = [
  { href: "/account", label: "Dashboard" },
  { href: "/admin/sales", label: "Sales" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/evaluation", label: "Evaluation" },
  { href: "/admin/payments", label: "Payments", badge: true },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/scan", label: "Scan" },
  { href: "/admin/users", label: "Users" },
  { href: "/events/manage", label: "Manage events", prefix: true },
  { href: "/account/profile", label: "Settings" },
];

function isActive(pathname, link) {
  if (link.prefix) {
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }
  return pathname === link.href;
}

function NavLinks({ pendingPayments, onNavigate }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const active = isActive(pathname, link);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
              active ? "bg-brand text-white" : "hover:bg-background"
            }`}
          >
            <span>{link.label}</span>
            {link.badge && pendingPayments > 0 ? (
              <span
                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${
                  active ? "bg-white text-brand" : "bg-red-600 text-white"
                }`}
              >
                {pendingPayments}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-brand"
      >
        Log out
      </button>
    </form>
  );
}

export function AdminSidebar({ pendingPayments = 0 }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-card px-3 py-4 md:flex">
        <Link href="/account" className="px-2">
          <Logo subtitle="Admin" />
        </Link>
        <div className="mt-6 flex-1 overflow-y-auto">
          <NavLinks pendingPayments={pendingPayments} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
          <ThemeToggle />
          <div className="flex-1">
            <SignOut />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/account">
            <Logo size={32} subtitle="Admin" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label="Toggle menu"
              aria-expanded={open}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-lg hover:border-brand"
            >
              <span aria-hidden="true">{open ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>
        {open ? (
          <div className="border-t border-line px-3 py-3">
            <NavLinks pendingPayments={pendingPayments} onNavigate={() => setOpen(false)} />
            <div className="mt-3">
              <SignOut />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}