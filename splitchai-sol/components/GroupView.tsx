"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { netBalances, settlePlan } from "@/lib/balances";
import { DEMO_SIGNATURE, MINT, TOKEN_SYMBOL, TREASURY, explorerAddr, explorerTx } from "@/lib/config";
import { demoGroup } from "@/lib/demo";
import { feeFor, formatUsdc, parseUsdc } from "@/lib/money";
import { customSplit, equalSplit } from "@/lib/split";
import { buildSettleTx, totalFee } from "@/lib/tx";
import type { Group, Transfer } from "@/lib/types";

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const nonce = () => Math.random().toString(36).slice(2, 10);

interface Receipt { signature: string; ms?: number; legs: number; total: number; fee: number; networkFeeLamports?: number | null; simulated?: boolean }

export default function GroupView({ id }: { id: string }) {
  const demo = id === "demo";
  const [g, setG] = useState<Group | null>(demo ? demoGroup() : null);
  const [err, setErr] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [me, setMe] = useState<string>("");
  const [busy, setBusy] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [tokenBal, setTokenBal] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const load = useCallback(async () => {
    if (demo) return;
    const r = await fetch(`/api/groups/${id}`, { cache: "no-store" });
    if (r.status === 404) return setNotFound(true);
    setG(await r.json());
  }, [demo, id]);

  useEffect(() => {
    setMe(localStorage.getItem(`splitsol:me:${id}`) || (demo ? "farah" : ""));
    load();
    if (demo) return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [id, demo, load]);

  const refreshBal = useCallback(async () => {
    if (!publicKey) return setTokenBal(null);
    try {
      const ata = getAssociatedTokenAddressSync(new PublicKey(MINT), publicKey);
      const b = await connection.getTokenAccountBalance(ata);
      setTokenBal(Number(b.value.amount));
    } catch {
      setTokenBal(0);
    }
  }, [publicKey, connection]);
  useEffect(() => { refreshBal(); }, [refreshBal]);

  const net = useMemo(() => (g ? netBalances(g) : {}), [g]);
  const plan = useMemo(() => settlePlan(net), [net]);
  const byId = useMemo(() => Object.fromEntries((g?.members ?? []).map((m) => [m.id, m])), [g]);
  const meM = me ? byId[me] : undefined;
  const myDebts = plan.filter((t) => t.from === me);

  function chooseMe(mid: string) {
    setMe(mid);
    localStorage.setItem(`splitsol:me:${id}`, mid);
  }

  async function post(path: string, body: unknown, method = "POST") {
    setErr("");
    const r = await fetch(`/api/groups/${id}${path}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "request failed");
    return j;
  }

  // ---------- members ----------
  const [newName, setNewName] = useState("");
  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !g) return;
    try {
      if (demo) {
        const m = { id: nonce(), name: newName.trim() };
        setG({ ...g, members: [...g.members, m] });
      } else setG(await post("/members", { name: newName }));
      setNewName("");
    } catch (e) { setErr((e as Error).message); }
  }
  async function linkWallet() {
    if (!publicKey || !meM) return setVisible(true);
    try { setG(await post("/members", { memberId: meM.id, wallet: publicKey.toBase58() })); } catch (e) { setErr((e as Error).message); }
  }

  // ---------- expenses ----------
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [mode, setMode] = useState<"equal" | "custom">("equal");
  const [parts, setParts] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const amtMicro = parseUsdc(amt) ?? 0;
  const customSum = Object.values(custom).reduce((s, v) => s + (parseUsdc(v) ?? 0), 0);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!g) return;
    const payer = paidBy || me || g.members[0].id;
    const participants = g.members.map((m) => m.id).filter((mid) => parts[mid] !== false);
    try {
      if (demo) {
        const amount = parseUsdc(amt);
        if (!amount || !desc.trim()) throw new Error("description and amount required");
        const shares = mode === "custom"
          ? customSplit(amount, Object.fromEntries(Object.entries(custom).map(([k, v]) => [k, parseUsdc(v) ?? 0])))
          : equalSplit(amount, participants);
        setG({ ...g, expenses: [...g.expenses, { id: nonce(), description: desc.trim(), amount, paidBy: payer, shares, splitMode: mode, createdAt: Date.now() }] });
      } else {
        setG(await post("/expenses", { description: desc, amount: amt, paidBy: payer, mode, participants, shares: custom }));
      }
      setDesc(""); setAmt(""); setCustom({});
    } catch (e) { setErr((e as Error).message); }
  }
  async function delExpense(eid: string) {
    if (!g) return;
    if (demo) return setG({ ...g, expenses: g.expenses.filter((x) => x.id !== eid) });
    try { setG(await post(`/expenses?eid=${eid}`, null, "DELETE")); } catch (e) { setErr((e as Error).message); }
  }

  // ---------- settle ----------
  async function settle(legs: Transfer[]) {
    if (!g) return;
    setErr(""); setReceipt(null);
    const total = legs.reduce((s, l) => s + l.amount, 0);
    const fee = totalFee(legs, g.feeBps);
    if (demo) {
      setBusy("Simulating one-tap settle…");
      await new Promise((r) => setTimeout(r, 900));
      setG({ ...g, settlements: [...g.settlements, ...legs.map((l, i) => ({ id: nonce(), from: l.from, to: l.to, amount: l.amount, fee: i === legs.length - 1 ? fee : 0, signature: DEMO_SIGNATURE || "simulated", verifiedAt: Date.now() }))] });
      setReceipt({ signature: DEMO_SIGNATURE, legs: legs.length, total, fee, simulated: true });
      setBusy("");
      return;
    }
    if (!publicKey) return setVisible(true);
    if (!meM?.wallet || meM.wallet !== publicKey.toBase58()) return setErr("Link this wallet to your name first.");
    const missing = legs.find((l) => !byId[l.to]?.wallet);
    if (missing) return setErr(`${byId[missing.to]?.name} hasn't linked a wallet yet. Share the invite link with them.`);
    if (tokenBal !== null && tokenBal < total + fee) return setErr(`You need ${formatUsdc(total + fee)} ${TOKEN_SYMBOL}. Tap "Get test ${TOKEN_SYMBOL}" first.`);
    try {
      setBusy("Waiting for your wallet…");
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const tx = buildSettleTx({
        payer: publicKey, mint: new PublicKey(MINT), decimals: 6, feeBps: g.feeBps, treasury: new PublicKey(TREASURY), groupId: g.id, nonce: nonce(),
        legs: legs.map((l) => ({ creditor: new PublicKey(byId[l.to].wallet!), amount: l.amount })),
      }, blockhash);
      const sig = await sendTransaction(tx, connection);
      const t0 = performance.now();
      setBusy("Confirming on Solana…");
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      const ms = performance.now() - t0;
      setBusy("Verifying receipt on-chain…");
      const j = await post("/settle", { signature: sig });
      setG(j.group);
      setReceipt({ signature: sig, ms, legs: legs.length, total, fee: j.fee, networkFeeLamports: j.networkFeeLamports });
      refreshBal();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(""); }
  }

  async function faucet() {
    if (!publicKey) return setVisible(true);
    setBusy(`Minting 100 ${TOKEN_SYMBOL} to your wallet…`);
    setErr("");
    try {
      const r = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: publicKey.toBase58() }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await refreshBal();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  function copyInvite() {
    navigator.clipboard?.writeText(location.href.split("?")[0]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (notFound) return <div className="card"><h2>Group not found</h2><p>Check the invite link, or <a href="/">start a new group</a>.</p></div>;
  if (!g) return <div className="card"><p className="muted">Loading group…</p></div>;

  const totalSpent = g.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="group">
      <section className="card ghead">
        <div>
          <h1>{g.name}</h1>
          <p className="muted">{g.members.length} people · {formatUsdc(totalSpent)} spent · {g.feeBps ? "0.3% settle fee" : "no fee"}</p>
        </div>
        <div className="row">
          {!demo && <button className="btn ghost" onClick={copyInvite}>{copied ? "Copied!" : "Copy invite link"}</button>}
          {demo && <span className="pill">Sample data · no wallet needed</span>}
        </div>
      </section>

      {busy && <div className="banner">{busy}</div>}
      {err && <div className="banner err">{err}</div>}
      {receipt && (
        <div className="card receipt" data-testid="receipt">
          <h3>✅ {receipt.simulated ? "Settled (demo simulation)" : "Settled on Solana devnet"}</h3>
          <p>
            {receipt.legs} payment{receipt.legs > 1 ? "s" : ""} totalling <b>{formatUsdc(receipt.total)}</b>
            {receipt.fee > 0 && <> + {formatUsdc(receipt.fee)} fee</>} in <b>one transaction</b>
            {receipt.ms !== undefined && <> · confirmed in <b>{(receipt.ms / 1000).toFixed(1)}s</b></>}
            {receipt.networkFeeLamports != null && <> · network fee ◎{(receipt.networkFeeLamports / 1e9).toFixed(6)}</>}
          </p>
          {receipt.signature && (
            <a href={explorerTx(receipt.signature)} target="_blank" rel="noreferrer">
              {receipt.simulated ? "See a real verified settle tx on Solana Explorer ↗" : `Receipt ${short(receipt.signature)} on Solana Explorer ↗`}
            </a>
          )}
        </div>
      )}

      <div className="cols">
        <div>
          <section className="card">
            <h2>You are</h2>
            <div className="chips">
              {g.members.map((m) => (
                <button key={m.id} className={`chip ${m.id === me ? "on" : ""}`} onClick={() => chooseMe(m.id)}>
                  {m.name}{m.wallet ? " 🔗" : ""}
                </button>
              ))}
            </div>
            <form onSubmit={addMember} className="inline">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add someone (name)" maxLength={30} />
              <button className="btn small">Add</button>
            </form>
            {!demo && meM && (
              <div className="wallet-box">
                {meM.wallet ? (
                  <p>Your wallet: <a href={explorerAddr(meM.wallet)} target="_blank" rel="noreferrer">{short(meM.wallet)}</a>
                    {connected && publicKey && publicKey.toBase58() !== meM.wallet && <span className="err"> (connected wallet differs)</span>}</p>
                ) : connected ? (
                  <button className="btn" onClick={linkWallet}>Link {short(publicKey!.toBase58())} to {meM.name}</button>
                ) : (
                  <button className="btn" onClick={() => setVisible(true)}>Connect wallet to receive & settle</button>
                )}
                {connected && (
                  <p className="muted">Balance: {tokenBal === null ? "…" : `${formatUsdc(tokenBal)} ${TOKEN_SYMBOL}`}{" "}
                    <button className="link" onClick={faucet}>Get test {TOKEN_SYMBOL}</button></p>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <h2>Add expense</h2>
            <form onSubmit={addExpense} className="form">
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What was it? (Dinner, cab…)" maxLength={60} required />
              <div className="inline">
                <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Amount (USDC)" inputMode="decimal" required />
                <select value={paidBy || me || g.members[0].id} onChange={(e) => setPaidBy(e.target.value)} aria-label="Paid by">
                  {g.members.map((m) => <option key={m.id} value={m.id}>paid by {m.name}</option>)}
                </select>
              </div>
              <div className="seg">
                <button type="button" className={mode === "equal" ? "on" : ""} onClick={() => setMode("equal")}>Split equally</button>
                <button type="button" className={mode === "custom" ? "on" : ""} onClick={() => setMode("custom")}>Custom amounts</button>
              </div>
              {mode === "equal" ? (
                <div className="chips">
                  {g.members.map((m) => (
                    <label key={m.id} className={`chip ${parts[m.id] !== false ? "on" : ""}`}>
                      <input type="checkbox" hidden checked={parts[m.id] !== false} onChange={(e) => setParts({ ...parts, [m.id]: e.target.checked })} />{m.name}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="custom">
                  {g.members.map((m) => (
                    <label key={m.id}>{m.name}<input value={custom[m.id] ?? ""} onChange={(e) => setCustom({ ...custom, [m.id]: e.target.value })} placeholder="0" inputMode="decimal" /></label>
                  ))}
                  <p className={customSum === amtMicro ? "muted" : "err"}>{formatUsdc(customSum)} of {formatUsdc(amtMicro)}</p>
                </div>
              )}
              <button className="btn">Add expense</button>
            </form>
          </section>
        </div>

        <div>
          <section className="card">
            <h2>Balances</h2>
            <ul className="bal">
              {g.members.map((m) => (
                <li key={m.id}><span>{m.name}{m.id === me ? " (you)" : ""}</span>
                  <b className={net[m.id] > 0 ? "pos" : net[m.id] < 0 ? "neg" : ""}>{net[m.id] === 0 ? "settled" : formatUsdc(net[m.id], { sign: true })}</b></li>
              ))}
            </ul>
          </section>

          <section className="card" data-testid="plan">
            <h2>Settle up</h2>
            {plan.length === 0 ? <p className="muted">Everyone is square. 🎉</p> : (
              <>
                <p className="muted">{plan.length} payment{plan.length > 1 ? "s" : ""} settle the whole group (fewest possible).</p>
                <ul className="plan">
                  {plan.map((t, i) => (
                    <li key={i}>
                      <span>{byId[t.from]?.name} → {byId[t.to]?.name}</span>
                      <b>{formatUsdc(t.amount)}</b>
                      {t.from === me && <button className="btn small" disabled={!!busy} onClick={() => settle([t])}>Pay</button>}
                    </li>
                  ))}
                </ul>
                {myDebts.length > 0 && (
                  <button className="btn big" disabled={!!busy} onClick={() => settle(myDebts)} data-testid="settle-all">
                    Settle all I owe · {formatUsdc(myDebts.reduce((s, t) => s + t.amount, 0))}{g.feeBps ? ` + ${formatUsdc(totalFee(myDebts, g.feeBps))} fee` : ""} · 1 tx
                  </button>
                )}
                {myDebts.length > 0 && (
                  <details className="txpeek">
                    <summary>What&apos;s inside that one transaction?</summary>
                    <ol>
                      {myDebts.map((t, i) => <li key={i}>SPL TransferChecked {formatUsdc(t.amount)} {TOKEN_SYMBOL} → {byId[t.to]?.name}{byId[t.to]?.wallet ? ` (${short(byId[t.to].wallet!)})` : ""}</li>)}
                      {g.feeBps > 0 && <li>SPL TransferChecked {formatUsdc(totalFee(myDebts, g.feeBps))} → treasury ({(g.feeBps / 100).toFixed(1)}%)</li>}
                      <li>Memo <code>splitchai|g={g.id}|n=…</code> (verified server-side)</li>
                    </ol>
                    <p className="muted">Atomic: all transfers succeed together or the whole transaction reverts.</p>
                  </details>
                )}
              </>
            )}
          </section>

          <section className="card">
            <h2>Expenses</h2>
            {g.expenses.length === 0 ? <p className="muted">No expenses yet.</p> : (
              <ul className="exp">
                {[...g.expenses].reverse().map((e) => (
                  <li key={e.id}>
                    <div><b>{e.description}</b><span className="muted"> · {byId[e.paidBy]?.name} paid · {e.splitMode === "equal" ? `split ${Object.keys(e.shares).length} ways` : "custom split"}</span></div>
                    <div className="right"><b>{formatUsdc(e.amount)}</b><button className="link" onClick={() => delExpense(e.id)} aria-label="Delete">✕</button></div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {g.settlements.length > 0 && (
            <section className="card">
              <h2>On-chain settlements</h2>
              <ul className="exp">
                {[...g.settlements].reverse().map((s) => (
                  <li key={s.id}>
                    <div><b>{byId[s.from]?.name} → {byId[s.to]?.name}</b> <span className="muted">{formatUsdc(s.amount)}{s.fee ? ` (+${formatUsdc(s.fee)} fee)` : ""}</span></div>
                    <div className="right">{s.signature && s.signature !== "simulated" ? <a href={explorerTx(s.signature)} target="_blank" rel="noreferrer">{demo ? "example tx ↗" : `verified ${short(s.signature)} ↗`}</a> : <span className="muted">simulated</span>}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      <p className="muted center">Fee preview for a $10 settle: {formatUsdc(feeFor(10_000_000, g.feeBps || 30))}. Devnet only: tokens have no value.</p>
    </div>
  );
}
