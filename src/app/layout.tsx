import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Games",
  description: "Personal PlayStation game library manager",
  applicationName: "My Games",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "My Games",
  },
  icons: {
    icon: [
      { url: "/assets/logo/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/assets/logo/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/logo/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/assets/logo/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#080a12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
