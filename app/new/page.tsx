"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORIES, CURRENCIES, type Category } from "@/lib/types";

type Row = { name: string; contact: string };

export default function NewPot() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [rows, setRows] = useState<Row[]>([
    { name: "", contact: "" },
    { name: "", contact: "" },
    { name: "", contact: "" },
  ]);
  const [target, setTarget] = useState("50");
  const [perBill, setPerBill] = useState("40");
  const [daily, setDaily] = useState("100");
  const [cats, setCats] = useState<Category[]>(["food", "groceries", "transport", "stay"]);
  const [approvals, setApprovals] = useState("1");
  const [treasury, setTreasury] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const toggle = (c: Category) => setCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const members = rows
        .filter((r) => r.name.trim() || r.contact.trim())
        .map((r) => {
          const c = r.contact.trim();
          return c.startsWith("0x") ? { name: r.name, wallet: c } : { name: r.name, email: c };
        });
      const res = await fetch("/api/pots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          currency,
          members,
          contributionTarget: target,
          policy: { perBillCap: perBill, dailyCap: daily, allowedCategories: cats, approvalsRequired: Number(approvals) },
          usdcTreasury: treasury,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      localStorage.setItem(`chaipot:actor:${d.pot.id}`, d.pot.members[0].id);
      router.push(`/p/${d.pot.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="top">
        <Link className="brand" href="/">
          <img src="/icon.svg" alt="" /> Chai Pot
        </Link>
      </header>
      <h1>Start a pot</h1>
      <form className="stack" onSubmit={submit} style={{ marginTop: 14 }}>
        <div className="card stack">
          <div>
            <label>Pot name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa trip, Flat 4B, Team offsite" required />
          </div>
          <div className="grid2">
            <div>
              <label>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Each member puts in</label>
              <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card stack">
          <h3>Members</h3>
          <p className="muted small">First row is you. Use an email (PayPal) or a 0x wallet (USDC on Base).</p>
          {rows.map((r, i) => (
            <div className="grid2" key={i}>
              <input placeholder={i === 0 ? "Your name" : "Name"} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
              <input placeholder="email or 0x…" value={r.contact} onChange={(e) => setRow(i, { contact: e.target.value })} />
            </div>
          ))}
          <button type="button" className="btn ghost" onClick={() => setRows((r) => [...r, { name: "", contact: "" }])}>
            + Add member
          </button>
        </div>

        <div className="card stack">
          <h3>Agent spending rules</h3>
          <div className="grid2">
            <div>
              <label>Per-bill cap</label>
              <input inputMode="decimal" value={perBill} onChange={(e) => setPerBill(e.target.value)} />
            </div>
            <div>
              <label>Daily cap</label>
              <input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
            </div>
          </div>
          <div>
            <label>Allowed categories</label>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button type="button" key={c} className={`chip ${cats.includes(c) ? "on" : ""}`} onClick={() => toggle(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label>Approvals needed above a cap</label>
            <input inputMode="numeric" value={approvals} onChange={(e) => setApprovals(e.target.value)} />
            <p className="muted small">From members other than the one asking.</p>
          </div>
          <details>
            <summary>Optional: accept USDC on Base</summary>
            <label style={{ marginTop: 8 }}>Pot treasury wallet (receives USDC)</label>
            <input placeholder="0x…" value={treasury} onChange={(e) => setTreasury(e.target.value)} />
          </details>
        </div>

        {error && <div className="notice bad">{error}</div>}
        <button className="btn" disabled={busy}>
          {busy ? "Creating…" : "Create pot"}
        </button>
      </form>
    </main>
  );
}
