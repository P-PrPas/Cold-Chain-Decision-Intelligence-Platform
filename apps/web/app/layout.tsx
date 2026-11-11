import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata = { title: "Cold Chain Decision Intelligence" };
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="app-header">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden="true">
              CC
            </span>{" "}
            COLDCHAIN<span className="brand-sub">SIMULATION STUDIO</span>
          </Link>
          <nav aria-label="Primary">
            <Link href="/demo">Demo</Link>
            <Link href="/workspace">Workspace</Link>
            <span className="environment">Synthetic environment</span>
          </nav>
        </header>
        <div id="content">{children}</div>
        <footer className="app-footer">
          <span>Cold Chain / Decision Intelligence</span>
          <span>Evidence / Scenarios / Human review</span>
        </footer>
      </body>
    </html>
  );
}
