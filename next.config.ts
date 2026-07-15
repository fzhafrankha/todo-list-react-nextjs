import type { NextConfig } from "next";

// A strict nonce-based CSP (script-src 'nonce-...' 'strict-dynamic') was
// tried and reverted: Next.js 16 + Turbopack does not thread a per-request
// nonce into statically prerendered pages' <script> tags (verified against
// a production build — the nonce appeared in the response header but never
// in the HTML), so every script load was blocked and the app never
// hydrated. 'unsafe-inline' here is a deliberate, documented tradeoff,
// consistent with style-src below and common practice for Next.js apps.
// Defense against injected scripts instead relies on: React's automatic
// JSX escaping (no dangerouslySetInnerHTML anywhere in this app), httpOnly
// session cookies (unreadable by injected JS even if XSS occurred), and
// Zod validation at every input boundary.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Dev-only: Next.js blocks cross-origin requests to dev-mode internals
  // (HMR, /_next/*) from hosts it doesn't recognize, to stop a malicious
  // site from embedding/probing your local dev server. A tunnel (Cloudflare,
  // ngrok, etc.) presents your own domain as a "foreign" origin from the
  // dev server's point of view, so it needs to be listed explicitly here.
  //
  // "0.0.0.0" is included below as requested, but note it will only ever
  // match a request whose Origin is literally "0.0.0.0" — Next.js's origin
  // matcher (node_modules/next/dist/server/lib/router-utils/csrf-protection.js)
  // explicitly rejects a bare "*"/"**" wildcard on purpose, specifically so
  // this can't be opened to "any origin". There is no config that does that.
  // To actually let a tunnel through, add its real hostname here, e.g.
  // "todo.yourdomain.com", or a subdomain wildcard like "*.yourdomain.com".
  allowedDevOrigins: ["0.0.0.0"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
