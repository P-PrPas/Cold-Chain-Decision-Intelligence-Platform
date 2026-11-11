import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Thai,
} from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { I18nProvider } from "./i18n-provider";
import { SiteFooter, SiteHeader } from "./site-chrome";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-thai",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
