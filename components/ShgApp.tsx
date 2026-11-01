"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComputedState, Ev, Group } from "@/lib/shg.ts";

type View = {
  group: Group; month: string; state: ComputedState;
  summary: { en: string; hi: string };
  balances: Record<string, { en: string; hi: string }>;
};
type Reply = { parsedBy: string; en: string; hi: string; proposal: Ev | null; blocked: boolean };
type Lang = "hi" | "en";

const inr = (n: number) => {
  const d = String(Math.round(Math.abs(n)));
  const rest = d.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (n < 0 ? "-" : "") + "₹" + (rest ? rest + "," + d.slice(-3) : d);
};

const T = {
  cash: { en: "Cash with the group", hi: "समूह के पास नकद" },
  savings: { en: "Total savings", hi: "कुल बचत" },
  loansOut: { en: "Loans out", hi: "बाहर उधार" },
  interest: { en: "Interest earned", hi: "ब्याज कमाया" },
  ask: { en: "Tell the agent (type or speak)", hi: "एजेंट को बताइए (लिखें या बोलें)" },
  send: { en: "Send", hi: "भेजें" },
  confirm: { en: "Confirm", hi: "पक्का करें" },
  cancel: { en: "Cancel", hi: "रद्द" },
  members: { en: "Members", hi: "सदस्य" },
  loans: { en: "Loans", hi: "उधार" },
  paid: { en: "paid", hi: "जमा" },
  unpaid: { en: "not paid", hi: "बाकी" },
  as: { en: "Recording as", hi: "दर्ज करने वाली" },
  listen: { en: "Read aloud", hi: "सुनिए" },
  reset: { en: "Reset demo", hi: "डेमो फिर से" },
  approve: { en: "Approve", hi: "मंज़ूर" },
  pending: { en: "waiting for approval", hi: "मंज़ूरी बाकी" },
  left: { en: "left", hi: "बाकी" },
  next: { en: "next", hi: "अगली किस्त" },
  log: { en: "Ledger (latest first)", hi: "खाता (नया पहले)" },
} as const;

const EXAMPLES = [
  "लता ने 200 जमा किए",
  "Shobha ne aaj 200 jama kiye",
  "Asha ko 3000 ka loan chahiye 6 mahine, silai machine ke liye",
  "Pooja ko 2000 udhaar chahiye",
  "Meena ki kist 545",
  "Sunita ka balance",
  "group ka hisaab",
];

export default function ShgApp({ id }: { id: string }) {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [lang, setLang] = useState<Lang>("hi");
  const [by, setBy] = useState("m2");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/groups/${id}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) setErr(d.error || "Could not load");
    else {
      setV(d);
      setBy((b) => (d.group.members.some((m: { id: string }) => m.id === b) ? b : d.group.members.find((m: { role: string }) => m.role === "treasurer")?.id || d.group.members[0].id));
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const post = async (body: object) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/groups/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, by }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      return d;
    } catch (e) { setErr((e as Error).message); return null; } finally { setBusy(false); }
  };

  const say = async (t = text) => {
    if (!t.trim()) return;
    setText(t); setReply(null);
    const d = await post({ op: "say", text: t });
    if (d) setReply(d);
  };
  const confirm = async (ev: Ev) => {
    const d = await post({ op: "confirm", ev });
    if (d) { setV(d); setReply(null); setText(""); }
  };
  const speak = (s: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(s);
    u.lang = lang === "hi" ? "hi-IN" : "en-IN"; u.rate = 0.9;
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  };
  const mic = () => {
    type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void; stop: () => void };
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const C = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!C) { setErr(lang === "hi" ? "इस ब्राउज़र में आवाज़ से लिखना नहीं चलता। Chrome में खोलें।" : "Voice input needs Chrome on Android or desktop."); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new C(); rec.lang = "hi-IN"; rec.interimResults = false;
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setText(t); say(t); };
    rec.onend = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  };

  if (err && !v) return <main><p className="card">{err}</p></main>;
  if (!v) return <main><p className="muted">Loading…</p></main>;
  const { group: g, state: st } = v;
  const name = (mid: string) => { const m = g.members.find((x) => x.id === mid); return m ? (lang === "hi" ? m.nameHi : m.name) : mid; };
  const out = st.loans.filter((l) => l.status === "approved");
  const pending = st.loans.filter((l) => l.status === "pending");
  const officers = g.members.filter((m) => m.role !== "member");

  return (
    <main>
      <header className="top">
        <a className="brand" href="/"><img src="/icon.svg" alt="" />Chai Pot <span className="muted" style={{ fontWeight: 600 }}>SHG</span></a>
        <div className="row" style={{ gap: 6 }}>
          <button className={"chip" + (lang === "hi" ? " on" : "")} onClick={() => setLang("hi")}>हिंदी</button>
          <button className={"chip" + (lang === "en" ? " on" : "")} onClick={() => setLang("en")}>English</button>
        </div>
      </header>

      {g.id === "demo" && <p className="muted" style={{ marginBottom: 8 }}>{lang === "hi" ? "नमूना समूह, डेमो डेटा (असली समूह नहीं)" : "Sample group with demo data (not a real group)"}</p>}

      <section className="card hero-card">
        <div className="muted">{g.name}{g.village ? " · " + g.village : ""}</div>
        <div className="muted" style={{ marginTop: 6 }}>{T.cash[lang]}</div>
        <div className="big">{inr(st.cash)}</div>
        <div className="row wrap" style={{ marginTop: 6, gap: 14 }}>
          <span>{T.savings[lang]}: <b>{inr(st.totalSavings)}</b></span>
          <span>{T.loansOut[lang]}: <b>{inr(out.reduce((s, l) => s + l.principalOutstanding, 0))}</b></span>
          <span>{T.interest[lang]}: <b>{inr(st.interestEarned)}</b></span>
        </div>
        <button className="chip light" style={{ marginTop: 10 }} onClick={() => speak(v.summary[lang])}>🔊 {T.listen[lang]}</button>
      </section>

      <section className="card">
        <div className="row"><h3>{T.ask[lang]}</h3>
          <label className="muted">{T.as[lang]}{" "}
            <select value={by} onChange={(e) => setBy(e.target.value)}>
              {g.members.map((m) => <option key={m.id} value={m.id}>{lang === "hi" ? m.nameHi : m.name} ({m.role})</option>)}
            </select>
          </label>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); say(); }} className="row" style={{ gap: 6, marginTop: 6 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={lang === "hi" ? "जैसे: लता ने 200 जमा किए" : "e.g. Lata ne 200 jama kiye"} style={{ flex: 1 }} />
          <button type="button" className={"btn ghost" + (listening ? " rec" : "")} onClick={mic} aria-label="Speak">🎤</button>
          <button className="btn" disabled={busy}>{busy ? "…" : T.send[lang]}</button>
        </form>
        <div className="row wrap" style={{ gap: 6, marginTop: 8, justifyContent: "flex-start" }}>
          {EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => say(x)} disabled={busy}>{x}</button>)}
        </div>
        {reply && (
          <div className={"reply " + (reply.blocked ? "bad" : reply.proposal ? "ok" : "")}>
            <p style={{ fontSize: 17 }}>{reply.hi}</p>
            <p className="muted">{reply.en}</p>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="chip" onClick={() => speak(lang === "hi" ? reply.hi : reply.en)}>🔊 {T.listen[lang]}</button>
              {reply.proposal && (
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn ghost" onClick={() => setReply(null)}>{T.cancel[lang]}</button>
                  <button className="btn" disabled={busy} onClick={() => confirm(reply.proposal!)}>{T.confirm[lang]}</button>
                </span>
              )}
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>understood by: {reply.parsedBy} · rules checked by the group's own rulebook</p>
          </div>
        )}
        {err && <p style={{ color: "var(--bad)", marginTop: 6 }}>{err}</p>}
      </section>

      {(pending.length > 0 || out.length > 0) && (
        <>
          <h2>{T.loans[lang]}</h2>
          {pending.map((l) => (
            <div key={l.loanId} className="card">
              <div className="row"><b>{name(l.memberId)} · {inr(l.amount)} · {l.tenureMonths} {lang === "hi" ? "महीने" : "months"}</b><span className="tag warn">{T.pending[lang]} {l.approvals.length}/{g.rules.approvalsNeeded}</span></div>
              <div className="muted">{l.purpose}{l.approvals.length ? " · ✓ " + l.approvals.map(name).join(", ") : ""}</div>
              <div className="row wrap" style={{ gap: 6, marginTop: 6, justifyContent: "flex-start" }}>
                {officers.filter((o) => o.id !== l.memberId && !l.approvals.includes(o.id)).map((o) => (
                  <button key={o.id} className="chip" disabled={busy} onClick={async () => {
                    const r = await fetch(`/api/groups/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "confirm", by: o.id, ev: { type: "loan_approve", loanId: l.loanId } }) });
                    const d = await r.json(); if (r.ok) setV(d); else setErr(d.error);
                  }}>✓ {T.approve[lang]}: {lang === "hi" ? o.nameHi : o.name}</button>
                ))}
              </div>
            </div>
          ))}
          {out.map((l) => (
            <div key={l.loanId} className="card row">
              <div><b>{name(l.memberId)}</b> <span className="muted">· {l.purpose}</span><div className="muted">{inr(l.amount)} · {T.next[lang]} {inr(l.nextDue?.total ?? 0)}</div></div>
              <div style={{ textAlign: "right" }}><b>{inr(l.principalOutstanding)}</b><div className="muted">{T.left[lang]}</div></div>
            </div>
          ))}
        </>
      )}

      <h2>{T.members[lang]} ({g.members.length})</h2>
      {g.members.map((m) => {
        const ms = st.members[m.id];
        return (
          <div key={m.id} className="card row" onClick={() => speak(v.balances[m.id][lang])} style={{ cursor: "pointer" }}>
            <div><b>{lang === "hi" ? m.nameHi : m.name}</b> {m.role !== "member" && <span className="muted">· {m.role === "leader" ? (lang === "hi" ? "अध्यक्ष" : "leader") : (lang === "hi" ? "कोषाध्यक्ष" : "treasurer")}</span>}
              <div className="muted">{inr(ms.savings)}{ms.monthsMissed > 0 ? ` · ${ms.monthsMissed} ${lang === "hi" ? "महीने बाकी" : "month(s) due"}` : ""}</div></div>
            <span className={"tag " + (ms.paidThisMonth ? "good" : "warn")}>{ms.paidThisMonth ? "✓ " + T.paid[lang] : T.unpaid[lang]}</span>
          </div>
        );
      })}

      <h2>{T.log[lang]}</h2>
      <div className="card" style={{ fontSize: 13 }}>
        {[...g.events].reverse().slice(0, 12).map((e) => (
          <div key={e.id} className="row" style={{ padding: "3px 0", borderBottom: "1px solid var(--line)" }}>
            <span>{e.month} · {e.type.replace("_", " ")} {"memberId" in e ? "· " + name(e.memberId) : "loanId" in e ? "· " + e.loanId : ""}</span>
            <span>{"amount" in e ? inr(e.amount) : ""}</span>
          </div>
        ))}
      </div>

      {g.id === "demo" && <p style={{ marginTop: 14 }}><button className="btn ghost" onClick={async () => { const d = await post({ op: "reset" }); if (d) { setV(d); setReply(null); } }}>{T.reset[lang]}</button></p>}
      <p className="muted" style={{ marginTop: 18 }}>Open source (MIT). Built with AgentFoundry SMART-Code for Code for a Billion 2026.</p>
    </main>
  );
}
