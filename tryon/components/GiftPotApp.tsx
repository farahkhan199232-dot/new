"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GiftPot, Product, ProductKind, Proposal, SkinConcern } from "@/lib/types.ts";
import { CATALOG, CONCERN_LABEL, KIND_API, product } from "@/lib/catalog.ts";
import { matchProduct, topConcerns } from "@/lib/match.ts";
import { funded, leader, paidBy, shares, tally, target } from "@/lib/pot.ts";
import { formatMoney } from "@/lib/money.ts";

const KIND_TABS: { id: "all" | ProductKind; label: string }[] = [
  { id: "all", label: "All" }, { id: "lip", label: "Lipstick" }, { id: "earring", label: "Jewellery" },
  { id: "top", label: "Outfits" }, { id: "skincare", label: "Skincare" },
];

const tone = (n: number) => (n >= 80 ? "good" : n >= 60 ? "mid" : "low");

export default function GiftPotApp({ id }: { id: string }) {
  const [pot, setPot] = useState<GiftPot | null>(null);
  const [me, setMe] = useState("");
  const [tab, setTab] = useState<"all" | ProductKind>("all");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState<string>("");
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);
  const [concern, setConcern] = useState<SkinConcern | null>(null);
  const [photoTick, setPhotoTick] = useState(0);

  useEffect(() => {
    fetch(`/api/pots/${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.pot) {
        setPot(j.pot);
        setMe(localStorage.getItem(`cpt:me:${id}`) || "");
      } else setToast({ text: j.error || "Pot not found", err: true });
    });
  }, [id]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); } }, [toast]);

  async function act(path: string, body: object, label: string, ok?: (j: any) => string) {
    setBusy(label);
    try {
      const res = await fetch(`/api/pots/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Something went wrong");
      setPot(j.pot);
      if (ok) setToast({ text: ok(j) });
      return j;
    } catch (e) {
      setToast({ text: (e as Error).message, err: true });
    } finally {
      setBusy("");
    }
  }

  function pickMe(mid: string) { setMe(mid); localStorage.setItem(`cpt:me:${id}`, mid); }
  const needMe = () => { if (!me) { setToast({ text: "First pick who you are (top of the page)", err: true }); return true; } return false; };

  async function uploadPhoto(file: File) {
    setBusy("Preparing photo…");
    try {
      const dataUrl = await downscale(file, 1280);
      await act("photo", { dataUrl }, "Uploading photo…", () => "Photo added. Now run Skin AI.");
      setPhotoTick((t) => t + 1);
    } catch (e) { setToast({ text: (e as Error).message, err: true }); setBusy(""); }
  }

  const ranked = useMemo(() => {
    if (!pot?.profile) return CATALOG.map((p) => ({ p, m: null as null | { score: number; why: string } }));
    return CATALOG.map((p) => ({ p, m: matchProduct(p, pot.profile!) })).sort((a, b) => b.m!.score - a.m!.score);
  }, [pot?.profile]);

  if (!pot) return <main><p className="muted">Loading…</p>{toast && <div className="toast err">{toast.text}</div>}</main>;

  const prof = pot.profile;
  const votes = new Map(tally(pot).map((t) => [t.proposalId, t.votes]));
  const lead = leader(pot);
  const locked = pot.proposals.find((p) => p.id === pot.lockedProposalId);
  const photoSrc = pot.demo ? "/demo/aisha.jpg" : pot.hasPhoto ? `/api/pots/${id}/photo?t=${photoTick}` : "";
  const sel = prof && concern ? prof.scores.find((s) => s.type === concern) : undefined;
  const proposalFor = (pid: string) => pot.proposals.find((x) => x.productId === pid);
  const memberName = (mid: string) => pot.members.find((m) => m.id === mid)?.name || "?";

  return (
    <main>
      <header className="top">
        <Link href="/" className="brand"><img src="/icon.svg" alt="" />Chai Pot <span>Try-On</span></Link>
        <div className="row gap wrap">
          {pot.demo && <button className="btn small secondary" onClick={() => act("reset", {}, "Resetting demo…", () => "Demo reset")}>Reset demo</button>}
          <Link href="/new" className="btn small secondary">New pot</Link>
        </div>
      </header>

      <section className="card hero">
        <div className="row wrap">
          <div>
            <h1>{pot.title}</h1>
            <p className="muted">{pot.occasion} gift for {pot.recipient} · budget up to {formatMoney(pot.budget)} · {pot.members.length} friends chipping in</p>
          </div>
          {pot.demo && <span className="badge" style={{ background: "#fff", color: "var(--rose)" }}>DEMO POT</span>}
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="muted small" style={{ marginBottom: 6 }}>I am:</div>
          <div className="chips">
            {pot.members.map((m) => (
              <button key={m.id} className={`chip ${me === m.id ? "on" : ""}`} onClick={() => pickMe(m.id)}>{m.name}</button>
            ))}
          </div>
        </div>
      </section>

      {/* STEP 1: Skin AI */}
      <section className="card">
        <div className="step-head"><span className="step">1</span><h2>{pot.recipient}'s skin &amp; tone</h2></div>
        <p className="muted">YouCam <b>AI Skin Analysis</b> (8 concerns) and <b>AI Facial Color Tones Analyzer</b> on one selfie. This drives every match score below.</p>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            {photoSrc ? <img className="photo" src={sel?.mask || photoSrc} alt={`${pot.recipient}`} /> : (
              <div className="card" style={{ textAlign: "center", margin: 0 }}>
                <p className="muted">Add a front-facing selfie of {pot.recipient}: face filling most of the frame, even daylight, ears visible.</p>
              </div>
            )}
            {prof && <p className="muted small" style={{ marginTop: 6 }}>{sel?.mask ? <>YouCam detection mask for <b>{CONCERN_LABEL[sel.type]}</b>. <a href="#" onClick={(e) => { e.preventDefault(); setConcern(null); }}>Show photo</a></> : "Tap a concern to see where YouCam found it."}</p>}
            {!pot.demo && (
              <label className="btn secondary block small" style={{ marginTop: 8, color: "var(--chai)" }}>
                {pot.hasPhoto ? "Replace photo" : "Add her photo"}
                <input type="file" accept="image/jpeg,image/png" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
              </label>
            )}
          </div>
          <div>
            {prof ? (
              <>
                <div className="row wrap" style={{ justifyContent: "flex-start", gap: 14, marginBottom: 10 }}>
                  <span><span className="swatch" style={{ background: prof.skinHex }} /> <b>Skin</b> <span className="muted">{prof.skinHex}</span></span>
                  <span className="badge">{prof.undertone} undertone</span>
                  <span className="badge">{prof.depth} depth</span>
                  {prof.eyeColor && <span className="muted small">Eyes: {prof.eyeColor}</span>}
                  <span className={`badge ${prof.source}`}>{prof.source === "live" ? "live YouCam result" : "cached real YouCam result"}</span>
                </div>
                {prof.scores.map((s) => (
                  <button key={s.type} className={`concern ${sel?.type === s.type ? "on" : ""}`} onClick={() => setConcern(s.type)}>
                    <span>{CONCERN_LABEL[s.type]}</span>
                    <span className="bar"><i className={tone(s.ui)} style={{ width: `${s.ui}%` }} /></span>
                    <b style={{ textAlign: "right" }}>{s.ui}</b>
                  </button>
                ))}
                <p className="muted small" style={{ marginTop: 8 }}>
                  Gift guide: {topConcerns(prof).length ? <>her lowest scores are <b>{topConcerns(prof).map((c) => CONCERN_LABEL[c.type].toLowerCase()).join(", ")}</b>, so skincare for those ranks high. </> : "her skin scores well across the board. "}
                  A <b>{prof.undertone}</b> undertone favours {prof.undertone === "warm" ? "gold, terracotta and jewel tones" : prof.undertone === "cool" ? "silver, berry and soft pastels" : "both warm and cool shades"}.
                </p>
              </>
            ) : <p className="muted">No Skin AI result yet.</p>}
            <div className="row wrap" style={{ justifyContent: "flex-start", marginTop: 10 }}>
              {(pot.hasPhoto || pot.demo) && (
                <button className="btn rose small" disabled={!!busy} onClick={() => act("analyze", { live: true }, "Running YouCam Skin AI (about 20 s)…", () => "Skin AI finished")}>
                  {pot.demo ? "Re-run Skin AI live (real API call)" : prof ? "Re-run Skin AI" : "Run Skin AI"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* STEP 2: Shelf */}
      <section className="card">
        <div className="row wrap">
          <div className="step-head"><span className="step">2</span><h2>Try gifts on {pot.recipient}</h2></div>
          {pot.demo && (
            <label className="toggle"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />Call the YouCam API live (~15 s, uses real units)</label>
          )}
        </div>
        <p className="muted">Sorted by Skin AI match. {pot.demo && !live ? "Demo mode shows cached real YouCam try-on results instantly; switch on live to render a fresh one." : "Each try-on is a real YouCam API call on her photo."}</p>
        <div className="tabs" style={{ margin: "10px 0" }}>
          {KIND_TABS.map((t) => <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        <div className="shelf">
          {ranked.filter(({ p }) => tab === "all" || p.kind === tab).map(({ p, m }) => {
            const existing = proposalFor(p.id);
            const over = p.price > pot.budget;
            return (
              <div className="item" key={p.id}>
                <Thumb p={p} />
                <div className="row"><b style={{ fontSize: 14 }}>{p.name}</b></div>
                <div className="row"><span className="muted">{formatMoney(p.price)}</span>{m && <span className={`badge ${tone(m.score)}`}>{m.score}% match</span>}</div>
                {m && <p className="muted small" style={{ margin: 0 }}>{m.why}</p>}
                <p className="muted small" style={{ margin: 0 }}>via {KIND_API[p.kind]}</p>
                <button className="btn small block" style={{ marginTop: "auto" }} disabled={!!busy || !prof || over || !!locked}
                  onClick={() => { if (needMe()) return; act("tryon", { memberId: me, productId: p.id, live }, p.kind === "skincare" ? "Adding to the vote…" : (live || !pot.demo) ? `Rendering ${p.name} on ${pot.recipient} with YouCam (about 15 s)…` : "Loading try-on…", () => `${p.name} added to the vote`); }}>
                  {over ? "Over budget" : existing ? (p.kind === "skincare" ? "Re-propose" : "Try on again") : p.kind === "skincare" ? "Propose" : "Try it on her"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* STEP 3: Vote */}
      <section className="card">
        <div className="row wrap">
          <div className="step-head"><span className="step">3</span><h2>Vote</h2></div>
          {!locked && pot.proposals.length > 0 && (
            <button className="btn small rose" disabled={!!busy} onClick={() => { if (needMe()) return; act("lock", { memberId: me }, "Closing the vote…", (j) => `${product(j.winner.productId).name} wins!`); }}>Close vote &amp; pick winner</button>
          )}
        </div>
        <p className="muted">{Object.keys(pot.votes).length} of {pot.members.length} friends have voted. Proposing counts as your vote; you can switch any time before the vote closes.</p>
        {pot.proposals.length === 0 ? <p className="muted">No ideas yet: try something on {pot.recipient} above.</p> : (
          <div className="props" style={{ marginTop: 10 }}>
            {[...pot.proposals].sort((a, b) => (votes.get(b.id)! - votes.get(a.id)!) || b.match - a.match).map((pr) => (
              <PropCard key={pr.id} pr={pr} pot={pot} votes={votes.get(pr.id) || 0} isLead={(locked ? locked.id : lead?.id) === pr.id}
                mine={pot.votes[me] === pr.id} locked={!!locked} by={memberName(pr.memberId)}
                voters={Object.entries(pot.votes).filter(([, v]) => v === pr.id).map(([k]) => memberName(k))}
                onVote={() => { if (needMe()) return; act("vote", { memberId: me, proposalId: pr.id }, "Voting…"); }} busy={!!busy} />
            ))}
          </div>
        )}
      </section>

      {/* STEP 4: Pool */}
      <section className="card">
        <div className="step-head"><span className="step">4</span><h2>Chip in</h2></div>
        {!locked ? <p className="muted">Close the vote to lock the winner and split its price.</p> : (
          <div className="grid2">
            <div>
              {locked.image ? <img className="photo" src={locked.image} alt="" /> : <Thumb p={product(locked.productId)} />}
            </div>
            <div>
              <h3>{product(locked.productId).name} · {formatMoney(target(pot))}</h3>
              <p className="muted">Split equally between {pot.members.length} friends (Chai Pot's paisa-exact split).</p>
              <div className="progress" style={{ margin: "10px 0" }}><i style={{ width: `${Math.min(100, (funded(pot) / Math.max(1, target(pot))) * 100)}%` }} /></div>
              <p className="muted small">{formatMoney(funded(pot))} of {formatMoney(target(pot))} pooled</p>
              {pot.members.map((m) => {
                const share = shares(pot)[m.id];
                const paid = paidBy(pot, m.id) >= share;
                return (
                  <div className="member-row" key={m.id}>
                    <span>{m.name} {m.id === me && <span className="muted small">(you)</span>}</span>
                    <span className="row gap">
                      <span>{formatMoney(share)}</span>
                      {paid ? <span className="pos">✓ paid</span> : (m.id === me || pot.demo) && !pot.order ? (
                        <button className="btn small rose" disabled={!!busy} onClick={() => act("chip", { memberId: m.id }, `Recording ${m.name}'s share…`, () => `${m.name} chipped in`)}>{m.id === me ? "Chip in (demo)" : `Pay as ${m.name} (demo)`}</button>
                      ) : <span className="muted small">pending</span>}
                    </span>
                  </div>
                );
              })}
              {pot.demo && !pot.order && <p className="muted small" style={{ marginTop: 6 }}>Demo pot: you can pay for each friend to see the whole flow.</p>}
              {pot.order && (
                <div className="card" style={{ marginTop: 12, background: "#eef8f0", borderColor: "#cfe8d5" }}>
                  <b className="pos">Gift ordered 🎁</b>
                  <p className="muted small" style={{ margin: "4px 0 0" }}>Demo order {pot.order.id}: {product(pot.order.productId).name}, {formatMoney(pot.order.amount)}, for {pot.recipient}. No real money moved; in Chai Pot proper the pot pays out through PayPal.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Activity</h2>
        <ul className="log">
          {pot.audit.slice(0, 20).map((a) => <li key={a.id}><span className="muted small">{new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> · {a.text}</li>)}
        </ul>
      </section>

      <footer className="muted small">
        Powered by the YouCam API (Perfect Corp): AI Skin Analysis · AI Facial Color Tones Analyzer · AI Makeup VTO · AI Earrings VTO · AI Clothes VTO.
        <br />Products are fictional; the demo face is AI-generated. Payments are demo-only.
      </footer>

      {busy && <div className="busy"><div className="card"><div className="spin" /><p>{busy}</p></div></div>}
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.text}</div>}
    </main>
  );
}

function Thumb({ p }: { p: Product }) {
  if (p.kind === "lip") return <div className="swatch-big" style={{ background: `linear-gradient(135deg, ${p.hex} 55%, #00000030)` }}>{p.lipTexture}</div>;
  if (p.kind === "skincare") return <div className="care-thumb">{p.name}<br />for {CONCERN_LABEL[p.concern!].toLowerCase()}</div>;
  return <img className="thumb" src={p.image} alt={p.name} />;
}

function PropCard(props: { pr: Proposal; pot: GiftPot; votes: number; isLead: boolean; mine: boolean; locked: boolean; by: string; voters: string[]; onVote: () => void; busy: boolean }) {
  const { pr, votes, isLead, mine, locked, by, voters, onVote, busy } = props;
  const p = product(pr.productId);
  return (
    <div className={`prop ${isLead ? "lead" : ""}`}>
      {pr.image ? <img src={pr.image} alt={`${p.name} on her`} /> : <Thumb p={p} />}
      <div className="body">
        <div className="row"><b>{p.name}</b>{isLead && <span className="badge" style={{ background: "var(--rose)", color: "#fff" }}>{locked ? "Winner" : "Leading"}</span>}</div>
        <div className="row"><span className="muted">{formatMoney(p.price)} · by {by}</span><span className={`badge ${tone(pr.match)}`}>{pr.match}%</span></div>
        <p className="muted small" style={{ margin: 0 }}>{pr.why}</p>
        <div className="row"><span className={`badge ${pr.source}`}>{pr.source === "live" ? "live" : "cached real"} YouCam</span><span className="muted small">{votes} vote{votes === 1 ? "" : "s"}</span></div>
        {voters.length > 0 && <p className="muted small" style={{ margin: 0 }}>{voters.join(", ")}</p>}
        {!locked && <button className={`btn small block ${mine ? "secondary" : ""}`} style={{ marginTop: "auto" }} disabled={busy || mine} onClick={onVote}>{mine ? "Your vote" : "Vote for this"}</button>}
      </div>
    </div>
  );
}

/** Resize in the browser so uploads stay small (YouCam needs >= 480px on the short side). */
async function downscale(file: File, max: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Could not read that image")); i.src = url; });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * s), h = Math.round(img.height * s);
    if (Math.min(w, h) < 480) throw new Error("Photo is too small: use one at least 480px on the short side");
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.9);
  } finally { URL.revokeObjectURL(url); }
}
