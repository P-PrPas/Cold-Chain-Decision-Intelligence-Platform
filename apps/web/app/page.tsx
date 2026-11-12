import type { Metadata } from "next";
import Landing from "@/app/landing/landing";

export const metadata: Metadata = {
  title:
    "Cold Chain Simulation Studio: excursion simulator for QA and logistics teams",
  description:
    "Replay a delayed shipment, keep missing readings unknown and compare four options by cost and delay. Decision support only. Does not certify food safety.",
  other: { "page-type": "software", "site-kind": "software" },
};

// Sets the hero's entrance flag before first paint (the design kit's motion layer).
const ENTER_SCRIPT = `document.documentElement.classList.add("m-enter");setTimeout(function(){document.documentElement.classList.add("m-enter-done")},700)`;

export default function Home() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/assets/motion/motion.css"
        precedence="default"
      />
      <script dangerouslySetInnerHTML={{ __html: ENTER_SCRIPT }} />
      <Landing />
    </>
  );
}
