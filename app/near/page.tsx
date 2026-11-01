import Link from "next/link";
import { NEAR_AGENT, NEAR_CONTRACT, NEAR_DEMO_POT, accountUrl } from "@/lib/near/config";

export default function NearHome() {
  return (
    <main className="wide landing">
      <header className="top">
        <Link href="/near" className="brand">
          <img src="/icon.svg" alt="" /> Chai Pot <span className="near-tag">on NEAR</span>
        </Link>
        <a href="https://github.com/farahkhan199232-dot/new/tree/near-pot" className="small">
          GitHub
        </a>
      </header>
      <h1>A group pot with an AI agent that can&apos;t overspend.</h1>
      <p className="lead">
        Friends pool NEAR for a trip, a flat or a team outing. An AI agent reviews every bill and pays the ones that make sense. The NEAR contract, not the model, decides how much it can move: small bills inside the caps pay instantly, bigger ones need a member&apos;s approval, and the agent&apos;s key can&apos;t do anything else.
      </p>
      <div className="cta">
        <Link className="btn" href={`/near/p/${NEAR_DEMO_POT}`}>
          Open the demo pot (no wallet needed)
        </Link>
        <Link className="btn secondary" href="/near/new">
          Create a pot with your NEAR wallet
        </Link>
      </div>
      <div className="steps" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>1. Chip in</h3>
          <p className="small">Members deposit testnet NEAR into the pot contract from their own wallet. Anyone can take back their unspent share.</p>
        </div>
        <div className="card">
          <h3>2. Ask in plain words</h3>
          <p className="small">&quot;Pay 0.4 NEAR to the café for chai and samosas.&quot; Gemini turns it into a request you sign on chain.</p>
        </div>
        <div className="card">
          <h3>3. Agent reviews</h3>
          <p className="small">The agent checks the payee on chain, recent bills and a NEAR Intents quote, then approves or rejects, with the hash of its full reasoning stored on chain.</p>
        </div>
        <div className="card">
          <h3>4. Contract enforces</h3>
          <p className="small">Inside the caps it pays at once. Above a cap it waits for member votes. Wrong category or no funds: rejected, whatever the model said.</p>
        </div>
      </div>
      <footer>
        Contract <a href={accountUrl(NEAR_CONTRACT)}>{NEAR_CONTRACT}</a> · agent <a href={accountUrl(NEAR_AGENT)}>{NEAR_AGENT}</a> (function-call key, <code>agent_review</code> only) · NEAR testnet, no real money. Built at NEAR HACKATHON 2026 on top of the
        pre-existing Chai Pot app (<a href="https://chai-pot.vercel.app">PayPal version</a>).
      </footer>
    </main>
  );
}
