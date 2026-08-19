import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incident Agent",
  description:
    "Multi-agent incident response for Vercel deployments: triage, parallel diagnosis, and human-approved remediation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-[#0a0a0a] font-sans text-[#ededed] antialiased">
        <header className="border-b border-[#1f1f1f]">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight">incident-agent</span>
              <span className="font-mono text-[11px] text-[#666]">multi-agent incident response</span>
            </Link>
            <nav className="flex items-center gap-4 font-mono text-[11px] text-[#888]">
              <a
                href="https://github.com/tayden-b/vercel-incident-agent"
                className="transition-colors hover:text-[#ededed]"
                target="_blank"
                rel="noreferrer"
              >
                github
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
