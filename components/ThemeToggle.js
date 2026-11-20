"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  // `mounted` stays false during server render AND the first client render, so
  // both produce the exact same markup (no hydration mismatch). The no-flash
  // script in the layout has already applied the real theme to <html> before
  // paint; we only read it back after mounting to pick the correct icon.
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Syncing one-time DOM state after mount; this is the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage may be unavailable; the theme still changes for this visit.
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-base hover:border-brand"
    >
      {/* Render a neutral icon until mounted to keep SSR and client identical. */}
      <span aria-hidden="true">{!mounted ? "\u25D1" : dark ? "\u2600\uFE0F" : "\u{1F319}"}</span>
    </button>
  );
}