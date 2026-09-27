import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "*.supabase.co";
const isPrivateBeta = (process.env.NEXT_PUBLIC_APP_MODE ?? "private_beta") !== "public";

/**
 * Content-Security-Policy. Third parties are whitelisted explicitly:
 * YouTube (nocookie embeds), Spotify (embeds), TMDB (images), Supabase (API + realtime).
 * Next.js hydration requires inline scripts; nonces would force every page dynamic and
 * defeat ISR, so 'unsafe-inline' is accepted for script-src (see DECISIONS.md).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: https://image.tmdb.org https://${supabaseHost} https://i.ytimg.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  "frame-src https://www.youtube-nocookie.com https://open.spotify.com",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://sandbox-api.iyzipay.com https://api.iyzipay.com https://sandbox-cpp.iyzipay.com https://cpp.iyzipay.com",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isPrivateBeta ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "framer-motion"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
