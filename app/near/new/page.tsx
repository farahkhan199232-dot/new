"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NEAR_AGENT, NEAR_DEMO_POT } from "@/lib/near/config";
import { isAccountId, toYocto } from "@/lib/near/units";
import { rpc, returnValue } from "@/lib/near/view";
import { activeAccount, onAccountChange, showSignIn, walletCall } from "@/components/near/wallet";

const CATS = ["food", "groceries", "transport", "stay", "tickets", "utilities"];

export default function NewNearPot() {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [name, setName] = useState("Weekend trip");
  const [members, setMembers] = useState("");
  const [perCap, setPerCap] = useState("1");
  const [dayCap, setDayCap] = useState("2");
  const [approvals, setApprovals] = useState(1);
  const [cats, setCats] = useState<string[]>(["food", "transport", "stay"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    activeAccount().then(setWallet).catch(() => {});
    let unsub: { unsubscribe: () => void } | undefined;
    onAccountChange(setWallet).then((s) => (unsub = s)).catch(() => {});
    // Redirect wallets (MyNearWallet) come back with ?transactionHashes=...: read the new pot id from the tx.
    const hash = new URLSearchParams(location.search).get("transactionHashes");
    if (hash) {
      activeAccount().then(async (acct) => {
        if (!acct) return;
        try {
          const tx = await rpc<{ status: unknown }>("tx", { tx_hash: hash.split(",").pop(), sender_account_id: acct, wait_until: "EXECUTED_OPTIMISTIC" });
          const id = returnValue<number>(tx as never);
          if (typeof id === "number") router.replace(`/near/p/${id}`);
        } catch (e) {
          setErr((e as Error).message);
        }
      });
    }
    return () => unsub?.unsubscribe();
  }, [router]);

  const list = members
    .split(/[\s,]+/)
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);

  const create = async () => {
    setErr("");
    const bad = list.find((m) => !isAccountId(m));
    if (bad) return setErr(`Not a NEAR account id: ${bad}`);
    if (list.length < 1) return setErr("Add at least one other member");
    if (approvals > list.length) return setErr("Approvals must be fewer than the number of members");
    setBusy(true);
    try {
      const res = await walletCall<number>("create_pot", {
        name,
        members: list,
        agent: NEAR_AGENT,
        per_spend_cap: toYocto(perCap),
        daily_cap: toYocto(dayCap),
        approvals_needed: approvals,
        categories: cats,
      });
      if (typeof res.value === "number") router.push(`/near/p/${res.value}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <header className="top">
        <Link href="/near" className="brand">
          <img src="/icon.svg" alt="" /> Chai Pot <span className="near-tag">on NEAR</span>
        </Link>
      </header>
      <h1>New pot</h1>
      <p className="muted">Created on NEAR testnet from your own wallet. You become the first member.</p>
      {!wallet ? (
        <div className="card stack">
          <p>Connect a NEAR testnet wallet (MyNearWallet or Meteor). New to testnet? Create a free account in the wallet; it comes with test NEAR.</p>
          <button className="btn" onClick={() => showSignIn()}>
            Connect NEAR wallet
          </button>
          <Link href={`/near/p/${NEAR_DEMO_POT}`} className="small">
            Or try the demo pot without a wallet
          </Link>
        </div>
      ) : (
        <div className="card stack">
          <p className="small">
            Signed in as <b>{wallet}</b>
          </p>
          <div>
            <label>Pot name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Other members (NEAR account ids, comma separated)</label>
            <input value={members} onChange={(e) => setMembers(e.target.value)} placeholder="friend1.testnet, friend2.testnet" />
          </div>
          <div className="grid2">
            <div>
              <label>Per-bill cap (NEAR)</label>
              <input value={perCap} onChange={(e) => setPerCap(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <label>Daily cap (NEAR)</label>
              <input value={dayCap} onChange={(e) => setDayCap(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <div>
            <label>Approvals needed above a cap</label>
            <input type="number" min={1} value={approvals} onChange={(e) => setApprovals(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <label>Allowed categories</label>
            <div className="chips">
              {CATS.map((c) => (
                <button key={c} className={`chip ${cats.includes(c) ? "on" : ""}`} onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <p className="small muted">
            Agent: {NEAR_AGENT}. It can only call <code>agent_review</code>; the contract enforces these limits.
          </p>
          <button className="btn" disabled={busy || !name || !cats.length} onClick={create}>
            {busy ? "Waiting for your wallet…" : "Create pot on NEAR"}
          </button>
          {err && <p className="neg small">{err}</p>}
        </div>
      )}
    </main>
  );
}
