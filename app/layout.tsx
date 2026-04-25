import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Betyg vs nationella prov",
  description: "Avvikelser mellan betyg och nationella prov per huvudman",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
            <Link href="/" className="font-semibold text-lg text-slate-900">
              Betyg vs nationella prov
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="px-3 py-1.5 rounded hover:bg-slate-100 text-slate-700 font-medium">
                Grundskola
              </Link>
              <Link href="/gymnasium" className="px-3 py-1.5 rounded hover:bg-slate-100 text-slate-700 font-medium">
                Gymnasium
              </Link>
              <Link href="/om" className="px-3 py-1.5 rounded hover:bg-slate-100 text-slate-700 font-medium">
                Om
              </Link>
            </nav>
            <div className="text-xs text-slate-500">Källa: Skolverket</div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-xs text-slate-500">
          Aggregat beräknade som viktat medel på elevantal. Rader med maskerade värden (Skolverkets integritetsskydd) exkluderas från aggregat.
        </footer>
      </body>
    </html>
  );
}
