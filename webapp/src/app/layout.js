import "./globals.css";

export const metadata = {
  title: {
    default: "Health Companion",
    template: "%s — Companion",
  },
  description:
    "Voice companion for hormonal health. Account, device and insights.",
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0e7c66",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
