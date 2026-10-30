"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewPot() {
  const r = useRouter();
  const [f, setF] = useState({ recipient: "", occasion: "Birthday", budget: "3500", members: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/pots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error || "Could not create the pot");
    localStorage.setItem(`cpt:me:${j.pot.id}`, j.pot.members[0].id);
    r.push(`/g/${j.pot.id}`);
  }

  return (
    <main className="narrow">
      <header className="top"><Link href="/" className="brand"><img src="/icon.svg" alt="" />Chai Pot <span>Try-On</span></Link></header>
      <form className="card" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <h2>Start a gift pot</h2>
        <div><label>Who is the gift for?</label><input value={f.recipient} onChange={up("recipient")} placeholder="Aisha" required /></div>
        <div><label>Occasion</label><input value={f.occasion} onChange={up("occasion")} /></div>
        <div><label>Max gift price (₹)</label><input value={f.budget} onChange={up("budget")} inputMode="decimal" /></div>
        <div><label>Friends chipping in (comma-separated, you first)</label><input value={f.members} onChange={up("members")} placeholder="Riya, Kabir, Meera" required /></div>
        {err && <p className="neg">{err}</p>}
        <button className="btn rose block" disabled={busy}>{busy ? "Creating…" : "Create pot"}</button>
        <p className="muted small">Next you'll add a selfie of her (ideally one she shares with you) and run YouCam Skin AI on it.</p>
      </form>
    </main>
  );
}
