import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PieceSprite } from "@/components/board/PieceSprite";
import { LiveRegion } from "@/components/layout/LiveRegion";
import { Providers } from "@/components/layout/Providers";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SETTINGS_BOOT_SCRIPT } from "@/lib/settings/store";

// Absolute base for social preview images, resolved at build time. Set SITE_URL to the public
// address when deploying; Vercel's production URL is picked up automatically.
const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Blindfold — learn to play chess without seeing the board", template: "%s · Blindfold" },
  description:
    "Free blindfold chess trainer: play Stockfish with the board hidden, train visualisation with drills, solve puzzles from text, and track your progress. No sign-up.",
  applicationName: "Blindfold",
  keywords: ["blindfold chess", "chess visualization", "chess training", "stockfish", "chess puzzles"],
  openGraph: {
    title: "Blindfold — chess without seeing the board",
    description: "Play, train and solve puzzles blindfolded. Free and open source.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-board-theme="nocturne" suppressHydrationWarning>
      <head>
        <Script id="bf-settings-boot" strategy="beforeInteractive">
          {SETTINGS_BOOT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only z-[200] rounded-lg bg-ivory-50 px-4 py-2 text-night-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <div className="page-atmosphere" aria-hidden="true" />
        <PieceSprite />
        <Providers>
          <SiteHeader />
          <main id="main" className="relative">
            {children}
          </main>
          <SiteFooter />
          <LiveRegion />
        </Providers>
      </body>
    </html>
  );
}
