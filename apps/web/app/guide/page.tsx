import type { Metadata } from "next";
import Guide from "./guide";

export const metadata: Metadata = {
  title: "Guide: Cold Chain Simulation Studio",
  description:
    "An illustrated guide to the Studio and the Workspace, with screenshots of the running app and numbered steps.",
};

export default function GuidePage() {
  return <Guide />;
}
