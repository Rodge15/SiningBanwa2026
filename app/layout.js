import { Geist } from "next/font/google";
import { Suspense } from "react";
import { AppFrame } from "@/components/AppFrame";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Sining Banwa",
  description: "Web-based event management prototype for Sining Banwa.",
};

// Runs before paint so the saved theme is applied with no flash of the wrong one.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<div className="flex-1" />}>
          <AppFrame>{children}</AppFrame>
        </Suspense>
      </body>
    </html>
  );
}