"use client";
import { useState } from "react";

export default function NewGroup() {
  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
  const [members, setMembers] = useState("");
  const [saving, setSaving] = useState("100");
  const [rate, setRate] = useState("1");
  const [minMonths, setMinMonths] = useState("0");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const list = members.split(/\n|,/).map((s) => s.trim()).filter(Boolean).map((n) => ({ name: n }));
    const r = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, village, members: list, rules: { monthlySaving: saving, interestPctPerMonth: rate, minMonthsMember: minMonths } }) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) setErr(d.error || "Failed"); else location.href = "/g/" + d.id;
  };
  return (
    <main>
      <header className="top"><a className="brand" href="/"><img src="/icon.svg" alt="" />Chai Pot SHG</a></header>
      <h1>नया समूह · New group</h1>
      <form onSubmit={submit} className="card stack" style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <label>समूह का नाम · Group name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>गाँव · Village<input value={village} onChange={(e) => setVillage(e.target.value)} /></label>
        <label>सदस्य (एक लाइन में एक नाम; पहली अध्यक्ष, दूसरी कोषाध्यक्ष) · Members, one per line: first is leader, second treasurer
          <textarea rows={8} value={members} onChange={(e) => setMembers(e.target.value)} required /></label>
        <label>हर महीने की बचत ₹ · Monthly saving<input inputMode="numeric" value={saving} onChange={(e) => setSaving(e.target.value)} /></label>
        <label>ब्याज % प्रति माह · Interest % per month<input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
        <label>उधार से पहले कितने महीने सदस्य · Months before a member can borrow<input inputMode="numeric" value={minMonths} onChange={(e) => setMinMonths(e.target.value)} /></label>
        <p className="muted">Loan limits default to 3× own savings and 50% of cash in hand, 12 months max, 2 approvals. No phone numbers or Aadhaar are collected.</p>
        {err && <p style={{ color: "var(--bad)" }}>{err}</p>}
        <button className="btn" disabled={busy}>{busy ? "…" : "समूह बनाएँ · Create"}</button>
      </form>
    </main>
  );
}
