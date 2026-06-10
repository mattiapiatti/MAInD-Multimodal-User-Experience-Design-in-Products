// In dev, Next blocks cross-origin requests to its internal resources (HMR
// websocket, /_next/*) unless the requesting host is allowlisted. Phones reach
// the app at http://<mac-lan-ip>:3000, a non-localhost origin, so without this
// the client never hydrates and forms fall back to a native GET submit (you get
// bounced back to /login). Allow the RFC1918 private ranges + mDNS .local so any
// device on the local network works. Dev-only; ignored by `next start`.
const lanDevOrigins = [
  "10.*.*.*",
  "192.168.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  "*.local",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: lanDevOrigins,

  // better-sqlite3 is a native addon; keep it out of the bundle so Next does not
  // try to trace/transpile it. It is required at runtime from node_modules.
  serverExternalPackages: ["better-sqlite3"],

  // Standalone output keeps the Docker image small: `next build` emits a
  // self-contained server under .next/standalone.
  output: "standalone",

  // The app is private (health data) — never index it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
