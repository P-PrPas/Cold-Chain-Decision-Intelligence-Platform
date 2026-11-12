import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  // This UI uses SVG/WebGL and no server-side image transformation.
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  // The sandbox moved from /demo to /studio. Query strings (?shipment=) are kept.
  async redirects() {
    return [{ source: "/demo", destination: "/studio", permanent: false }];
  },
};
export default config;
