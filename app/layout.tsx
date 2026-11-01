import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#7a3e12" };
export const metadata: Metadata = {
  title: "Chai Pot for SHGs: an AI agent that keeps a self-help group's savings pot",
  description: "Savings, loans checked against the group's own rules, and balances in plain Hindi and English. Speak or type; nothing is saved until an office bearer confirms.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body>{children}</body>
    </html>
  );
}
