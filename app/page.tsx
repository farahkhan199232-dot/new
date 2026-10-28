import Link from "next/link";

export default function Landing() {
  return (
    <main className="wide landing">
      <header className="top">
        <span className="brand">
          <img src="/icon.svg" alt="" /> Chai Pot
        </span>
        <Link className="btn small secondary" href="/p/demo">
          Open demo pot
        </Link>
      </header>

      <section style={{ padding: "28px 0 12px" }}>
        <span className="badge">PayPal + AI agent</span>
        <h1 style={{ marginTop: 12 }}>
          One pot for the group.
          <br />
          An agent that pays the bills, within your rules.
        </h1>
        <p className="lead">
          Trips, flats and team outings run on one person fronting money and chasing everyone after. Chai Pot flips it: everyone chips in up
          front with PayPal, and an AI agent pays the group&apos;s bills from the pot, but only inside the limits the members set. Anything
          bigger waits for the group to approve.
        </p>
        <div className="cta">
          <Link className="btn" href="/p/demo">
            Try the demo pot
          </Link>
          <Link className="btn secondary" href="/new">
            Start a pot
          </Link>
        </div>
      </section>

      <h2>The problem</h2>
      <div className="steps">
        <div className="card">
          <h3>Someone always fronts the money</h3>
          <p className="muted">One friend pays the villa, the cab and the dinner, then spends a week chasing UPI pings and spreadsheet math.</p>
        </div>
        <div className="card">
          <h3>Shared cards have no rules</h3>
          <p className="muted">A joint account or a shared card means anyone can spend anything. Nobody wants that.</p>
        </div>
        <div className="card">
          <h3>Agents can pay, but should they?</h3>
          <p className="muted">An AI that pays bills is only useful if it can&apos;t overspend. The limits must belong to the people whose money it is.</p>
        </div>
      </div>

      <h2>How Chai Pot works</h2>
      <div className="steps">
        <div className="card">
          <h3>1. Set the rules</h3>
          <p className="muted">Create a pot, add members, set a contribution target, a per-bill cap, a daily cap, allowed categories and how many approvals bigger bills need.</p>
        </div>
        <div className="card">
          <h3>2. Fund with PayPal</h3>
          <p className="muted">Each member pays their share through PayPal Checkout. The server captures the order and records exactly what PayPal confirms. USDC on Base is optional.</p>
        </div>
        <div className="card">
          <h3>3. Ask the agent</h3>
          <p className="muted">Snap a receipt or type &ldquo;pay the $24 dinner at Saravana to host@example.com&rdquo;. NVIDIA Nemotron (on Nebius Token Factory) itemizes it and proposes a split.</p>
        </div>
        <div className="card">
          <h3>4. Policy decides, PayPal pays</h3>
          <p className="muted">A deterministic policy engine checks caps, category and funds. Within limits: paid instantly with PayPal Payouts. Above: held for approvals. Every step lands in the audit log.</p>
        </div>
      </div>

      <h2>Why it&apos;s safe</h2>
      <div className="card">
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>The AI only interprets. Money moves only when the rules engine says so.</li>
          <li>Prompt-injection in a request can&apos;t raise a limit: limits are not something the model controls.</li>
          <li>Contributions are recorded from PayPal&apos;s capture response, not from the browser.</li>
          <li>Unspent money goes back to the member through a PayPal refund on their own payment.</li>
        </ul>
      </div>

      <footer>Built for the PayPal AI Hackathon 2026 · Sandbox only, no real money moves · MIT licensed</footer>
    </main>
  );
}
