import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { PieceSprite } from "@/components/board/PieceSprite";
import { LiveRegion } from "@/components/layout/LiveRegion";
import { MobileDock } from "@/components/layout/MobileDock";
import { Providers } from "@/components/layout/Providers";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StudioBackdrop } from "@/components/layout/StudioBackdrop";
import { Toaster } from "@/components/ui/Toaster";
import { SETTINGS_BOOT_SCRIPT } from "@/lib/settings/store";
import { displayFont, textFont } from "./fonts";

// Absolute base for social preview images, resolved at build time. Set SITE_URL to the public
// address when deploying; Vercel's production URL is picked up automatically.
const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Blindfold Chess: play and train without seeing the board", template: "%s · Blindfold Chess" },
  description:
    "Free blindfold chess: play Stockfish while the pieces fade and the board melts away, train visualisation with drills, solve puzzles from text, and track your progress. No sign-up.",
  applicationName: "Blindfold Chess",
  keywords: ["blindfold chess", "chess visualization", "chess training", "stockfish", "chess puzzles"],
  openGraph: {
    title: "Blindfold Chess",
    description: "Play, train and solve puzzles with the board hidden. Free and open source.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ececec" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1d1d" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: the on-screen keyboard shrinks the layout, so the move bar stays above it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-board-theme="studio" className={`${textFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
      <head>
        <Script id="bf-settings-boot" strategy="beforeInteractive">
          {SETTINGS_BOOT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="pill-primary sr-only z-[200] rounded-full px-5 py-2.5 text-small font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <StudioBackdrop />
        <PieceSprite />
        <Providers>
          <div className="overflow-x-clip px-[var(--stage-gutter)] pb-[var(--stage-gutter)] pt-[var(--stage-gutter)] sm:px-4 sm:pb-6 sm:pt-4 lg:px-8 lg:pb-8 lg:pt-6">
            <div className="glass-stage relative mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-[86rem] flex-col rounded-[1.375rem] sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-stage lg:min-h-[calc(100dvh-3.5rem)]">
              <SiteHeader />
              <main id="main" tabIndex={-1} className="relative flex-1 outline-none">
                {children}
              </main>
              <SiteFooter />
            </div>
          </div>
          <MobileDock />
          <Toaster />
          <LiveRegion />
        </Providers>
      </body>
    </html>
  );
}
