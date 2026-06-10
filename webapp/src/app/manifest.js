// Web App Manifest (served at /manifest.webmanifest). Makes the site
// installable and, once added to the Home Screen, run as a standalone app —
// no Safari address bar or toolbar chrome.
export default function manifest() {
  return {
    name: "Health Companion",
    short_name: "Companion",
    description:
      "Voice companion for hormonal health. Account, device and insights.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f4",
    theme_color: "#0e7c66",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
