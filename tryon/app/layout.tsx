import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#7a3e12" };

export const metadata: Metadata = {
  title: "Chai Pot Try-On: group gifts that actually suit her",
  description:
    "Friends pool money for a beauty or fashion gift. YouCam Skin AI reads her skin and tone, YouCam virtual try-on shows each idea on her photo, the group votes, and the pot pays for the winner.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
