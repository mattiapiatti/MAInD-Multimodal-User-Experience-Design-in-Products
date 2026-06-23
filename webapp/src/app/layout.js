import "./globals.css";
import GlassBackground from "@/components/shell/GlassBackground";

export const metadata = {
  title: {
    default: "Health Companion",
    template: "%s — Companion",
  },
  description:
    "Voice companion for hormonal health. Account, device and insights.",
  robots: { index: false, follow: false },
  // Installable PWA. Once added to the Home Screen on iOS/Android, it launches
  // full-screen with no browser address bar or toolbar chrome.
  manifest: "/manifest.webmanifest",
  applicationName: "Companion",
  appleWebApp: {
    capable: true,
    title: "Companion",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0c1714",
};

// Applied before first paint so the saved theme is in place with no flash.
// Defaults to dark (the app's original look) when nothing is stored.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <GlassBackground />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
