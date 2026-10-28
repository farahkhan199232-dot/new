import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#7a3e12" };

export const metadata: Metadata = {
  title: "Chai Pot: a group wallet with an AI agent that pays the bills",
  description: "Pool money with friends via PayPal. An AI agent pays group bills within the limits you set, and asks before anything bigger.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
