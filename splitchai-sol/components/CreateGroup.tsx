"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateGroup() {
  const r = useRouter();
  const [name, setName] = useState("");
  const [you, setYou] = useState("");
  const [others, setOthers] = useState("");
  const [fee, setFee] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, yourName: you, members: others.split(",").map((s) => s.trim()).filter(Boolean), fee }),
    });
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error || "Something went wrong");
      setBusy(false);
      return;
    }
    localStorage.setItem(`splitsol:me:${j.id}`, j.memberId);
    r.push(`/g/${j.id}`);
  }
  return (
    <form className="card form" onSubmit={submit} id="create">
      <h2>Start a group</h2>
      <label>Group name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa trip 2026" required maxLength={50} /></label>
      <label>Your name<input value={you} onChange={(e) => setYou(e.target.value)} placeholder="Farah" required maxLength={30} /></label>
      <label>Friends (comma separated, optional)<input value={others} onChange={(e) => setOthers(e.target.value)} placeholder="Aisha, Bilal, Chirag" /></label>
      <label className="check"><input type="checkbox" checked={fee} onChange={(e) => setFee(e.target.checked)} /> 0.3% settle fee to the SplitChai treasury (same transaction)</label>
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create group"}</button>
    </form>
  );
}
