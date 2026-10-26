import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { BRAND, SITE_URL } from "@/lib/config";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} | Book a tutoring session`,
    template: `%s | ${BRAND.name}`,
  },
  description: `${BRAND.tagline} Pick a service, choose a time and book online. Sample project: a fictional business.`,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} | Book a tutoring session`,
  },
};

export const viewport: Viewport = {
  themeColor: "#172036",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="on-dark bg-ink text-white">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
            <Link
              prefetch={false}
              href="/"
              className="font-display text-lg font-bold tracking-tight"
            >
              <span
                aria-hidden="true"
                className="mr-2 inline-block h-3 w-3 rounded-full bg-amber"
              />
              <span className="sm:hidden">Larkspur</span>
              <span className="hidden sm:inline">{BRAND.name}</span>
            </Link>
            <nav
              aria-label="Primary"
              className="flex items-center gap-5 text-sm"
            >
              <Link
                prefetch={false}
                href="/#services"
                className="hidden hover:text-amber sm:inline"
              >
                Services
              </Link>
              <Link
                prefetch={false}
                href="/book"
                className="btn btn-primary !min-h-10 !px-4 !py-1.5 whitespace-nowrap"
              >
                Book a session
              </Link>
            </nav>
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="on-dark bg-ink text-white/85">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>
              <strong className="text-white">Sample project.</strong>{" "}
              {BRAND.name} is a fictional business built for a portfolio.
              Bookings here are not real.
            </p>
            <Link
              prefetch={false}
              href="/admin"
              className="underline underline-offset-4 hover:text-amber"
            >
              Admin
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
