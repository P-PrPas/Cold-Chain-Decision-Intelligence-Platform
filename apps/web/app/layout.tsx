import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Thai,
} from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { I18nProvider } from "@/i18n/provider";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

// Sans is one variable file (all weights). Thai glyphs come from Plex Sans Thai,
// loaded only on pages that contain Thai text (unicode-range) and only the two
// weights the UI uses. Mono keeps the two weights numbers use.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "600"],
  variable: "--font-plex-thai",
  display: "swap",
  preload: false,
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cold Chain Simulation Studio",
  description:
    "Decision support for cold-chain excursions. Does not certify food safety.",
};

// Runs before first paint so the saved language and theme apply without a flash.
const PREFS_SCRIPT = `try{var d=document.documentElement,l=localStorage.getItem("cc-lang"),t=localStorage.getItem("cc-theme");if(l==="th"||l==="en")d.lang=l;if(t==="dark"||t==="light")d.dataset.theme=t}catch(e){}`;

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexThai.variable} ${plexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_SCRIPT }} />
      </head>
      <body>
        <I18nProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
