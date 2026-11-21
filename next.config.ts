import type { NextConfig } from "next";

/**
 * Static response headers for every route and asset. Framing policy (`frame-ancestors`,
 * `X-Frame-Options`) depends on runtime configuration and is set per request in `src/proxy.ts`.
 * `script-src` is deliberately absent: routes render per request and Next.js emits inline
 * hydration scripts; backoffice routes get a nonce-based CSP from src/proxy.ts.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

/**
 * `page.dev.tsx` files (the `/__kit` component kit) are routes only outside production builds:
 * `next build` runs with NODE_ENV=production, so they never reach the build output or the route
 * manifest (tests/browser/sign-in.spec.ts checks both).
 */
const pageExtensions =
  process.env.NODE_ENV === "production"
    ? ["tsx", "ts", "jsx", "js"]
    : ["dev.tsx", "tsx", "ts", "jsx", "js"];

const nextConfig: NextConfig = {
  output: "standalone",
  pageExtensions,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
