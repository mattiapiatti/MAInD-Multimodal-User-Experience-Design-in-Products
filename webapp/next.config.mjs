import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Lets `next dev` access Cloudflare bindings (the Durable Object) via
// getCloudflareContext(), emulated from wrangler.jsonc.
initOpenNextCloudflareForDev();

// Dev: allow phones on the LAN to reach Next's internal/HMR resources, otherwise
// the page won't hydrate when opened at http://<lan-ip>:3000.
const lanDevOrigins = [
  "10.*.*.*",
  "192.168.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  "*.local",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: lanDevOrigins,

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
