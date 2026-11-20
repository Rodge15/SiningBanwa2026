"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Responsive navigation. On desktop it is a horizontal bar; on mobile it
// collapses behind a hamburger that opens a full-width dropdown. `auth` is the
// server-rendered AuthNav element (sign-in links or account links).
export function HeaderNav({ auth }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <nav
        onClick={() => setOpen(false)}
        className={`${
          open ? "flex" : "hidden"
        } absolute inset-x-0 top-full z-30 flex-col gap-3 border-b border-line bg-card px-4 py-4 text-sm shadow-sm md:static md:z-auto md:flex md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-5 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        <Link href="/" className="hover:text-brand">
          Home
        </Link>
        <Link href="/events" className="hover:text-brand">
          Events
        </Link>
        {auth}
      </nav>

      <ThemeToggle />

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Toggle menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-lg hover:border-brand md:hidden"
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      </button>
    </div>
  );
}