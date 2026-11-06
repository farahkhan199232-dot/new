"use client";
import dynamic from "next/dynamic";
// wallet-adapter's button reads window; render it client-side only.
export const WalletButton = dynamic(async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton, {
  ssr: false,
  loading: () => <button className="btn ghost" disabled>Connect wallet</button>,
});
