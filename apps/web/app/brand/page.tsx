import type { Metadata } from "next";
import { BrandContent } from "./brand-content";

export const metadata: Metadata = {
  title: "Brand tokens",
  robots: { index: false, follow: false },
};

export default function BrandPage() {
  return <BrandContent />;
}
