import type { Metadata, Viewport } from "next";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "SplitChai Sol: split bills, settle in USDC on Solana in one tap",
  description: "Friend-group expense splitting that settles every debt in a single atomic Solana transaction. Devnet demo.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1c1410" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
