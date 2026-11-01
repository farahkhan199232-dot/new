import type { Metadata } from "next";
import "@near-wallet-selector/modal-ui/styles.css";

export const metadata: Metadata = {
  title: "Chai Pot on NEAR: a group pot whose AI agent can only spend inside limits the contract enforces",
  description: "Friends pool NEAR in a pot. A Gemini agent with a function-call-only key reviews every spend; the NEAR contract enforces caps and member votes. Testnet.",
};

export default function NearLayout({ children }: { children: React.ReactNode }) {
  return children;
}
