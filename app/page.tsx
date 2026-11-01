export default function Home() {
  return (
    <main>
      <header className="top"><a className="brand" href="/"><img src="/icon.svg" alt="" />Chai Pot <span className="muted" style={{ fontWeight: 600 }}>SHG</span></a></header>
      <section className="card hero-card">
        <h1 style={{ color: "#fff" }}>बचत गट का हिसाब, अब आवाज़ से</h1>
        <p style={{ marginTop: 6 }}>An AI agent that keeps a women&apos;s self-help group&apos;s savings pot: monthly savings, loans checked against the group&apos;s own rules, and balances read out in plain Hindi and English.</p>
        <p className="row" style={{ gap: 8, justifyContent: "flex-start", marginTop: 10 }}>
          <a className="btn" href="/g/demo" style={{ background: "#fff", color: "var(--chai)" }}>डेमो देखें · Try the demo</a>
          <a className="btn ghost" href="/new" style={{ color: "#fff", borderColor: "#fff" }}>नया समूह · New group</a>
        </p>
      </section>
      <h2>How it works</h2>
      <div className="card"><b>1. Speak or type, in any mix of Hindi and English.</b><p className="muted">&quot;Lata ne 200 jama kiye&quot;, &quot;आशा को 3000 का उधार 6 महीने&quot;, &quot;group ka hisaab&quot;.</p></div>
      <div className="card"><b>2. The rulebook checks it.</b><p className="muted">Loan limits (3× own savings, 50% of cash), unpaid dues, one loan at a time, minimum membership, tenure. The AI only reads the words; the group&apos;s rules decide.</p></div>
      <div className="card"><b>3. Nothing is saved until an office bearer confirms.</b><p className="muted">Loans need two approvals from the leader and treasurer, never the borrower. Every entry goes into an append-only ledger.</p></div>
      <div className="card"><b>4. Everyone can hear their balance.</b><p className="muted">Tap a member to hear her savings, dues and next loan payment read aloud in Hindi.</p></div>
      <p className="muted" style={{ marginTop: 16 }}>Open source (MIT). Built with AgentFoundry SMART-Code for Code for a Billion 2026 (Code for India). Demo data is sample data, not a real group.</p>
    </main>
  );
}
