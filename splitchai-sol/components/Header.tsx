import Link from "next/link";
import { WalletButton } from "./WalletButton";

export default function Header() {
  return (
    <header className="top">
      <Link href="/" className="brand">
        <span className="cup">☕</span> SplitChai <span className="sol">Sol</span>
      </Link>
      <div className="top-right">
        <span className="pill devnet">Devnet</span>
        <WalletButton />
      </div>
    </header>
  );
}
