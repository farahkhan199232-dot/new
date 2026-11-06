import Link from "next/link";
import Header from "@/components/Header";
import CreateGroup from "@/components/CreateGroup";
import { DEMO_SIGNATURE, MINT, explorerAddr, explorerTx } from "@/lib/config";

export default function Home() {
  return (
    <>
      <Header />
      <main className="wrap">
        <section className="hero">
          <h1>Split the bill. Settle everyone in <em>one tap</em>.</h1>
          <p className="lead">
            SplitChai Sol tracks shared expenses for your friend group, works out the fewest payments needed, and settles them in USDC on Solana.
            Every debt you owe goes out in <b>a single atomic transaction</b>: under a second, for a fraction of a cent, with an on-chain receipt.
          </p>
          <div className="row">
            <Link className="btn" href="/g/demo">Try the demo group (no wallet)</Link>
            <a className="btn ghost" href="#create">Start your own</a>
          </div>
        </section>

        <section className="grid3">
          <div className="card feat"><h3>⚡ One tx, many payees</h3><p>Owe three friends? One signature sends all three SPL TransferChecked instructions, the 0.3% fee and a memo, atomically. All land or none do.</p></div>
          <div className="card feat"><h3>🧾 Receipts read from chain</h3><p>The server records a payment only after fetching the confirmed transaction from Solana and checking mint, payer, payee, amount and the group memo.</p></div>
          <div className="card feat"><h3>🪙 Fees that make sense</h3><p>A ₹200 chai split costs about $0.0005 in network fees on Solana. That is why settling small debts on-chain finally works.</p></div>
        </section>

        <CreateGroup />

        <section className="card small">
          <h3>How it works</h3>
          <ol>
            <li>Create a group and share the invite link. Everyone picks their name and links a Phantom, Solflare or Backpack wallet.</li>
            <li>Add expenses with equal or custom splits. Balances and a minimal settle-up plan update instantly.</li>
            <li>Tap <b>Settle all</b>: your wallet signs one devnet transaction that pays everyone you owe.</li>
          </ol>
          <p className="muted">
            Devnet only, no real money. Test token tUSDC <a href={explorerAddr(MINT)} target="_blank" rel="noreferrer">{MINT.slice(0, 6)}…</a> (6 decimals, free from the in-app faucet).
            {DEMO_SIGNATURE && <> Example settle: <a href={`/r/${DEMO_SIGNATURE}`}>on-chain receipt</a> · <a href={explorerTx(DEMO_SIGNATURE)} target="_blank" rel="noreferrer">Solana Explorer</a>.</>}
          </p>
        </section>
      </main>
      <footer className="foot">MIT licensed · built for the MLH Solana Hackathon 2026 · <a href="https://github.com/farahkhan199232-dot/new/tree/splitchai-sol">source</a></footer>
    </>
  );
}
