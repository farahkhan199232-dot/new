"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuditEntry, Pot, Spend } from "@/lib/types";
import { computeLedger, refundableAmount } from "@/lib/ledger";
import { formatMoney, splitEqual } from "@/lib/money";
import { spentOnDay } from "@/lib/policy";
import { PayPalFund } from "./PayPalFund";
import { UsdcFund } from "./UsdcFund";

interface Config {
  paypal: boolean;
  paypalClientId: string;
  paypalEnv: string;
  ai: boolean;
  model: string;
  usdc: boolean;
  store: string;
}

type Tab = "pot" | "agent" | "bills" | "audit";

export function PotApp({ id }: { id: string }) {
  const [pot, setPot] = useState<Pot | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [actor, setActorState] = useState("");
  const [tab, setTab] = useState<Tab>("pot");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch(`/api/pots/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setPot(d.pot);
        const saved = localStorage.getItem(`chaipot:actor:${id}`);
        setActorState(saved && d.pot.members.some((m: { id: string }) => m.id === saved) ? saved : d.pot.members[0].id);
      })
      .catch((e) => setError((e as Error).message));
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, [id]);

  const setActor = (a: string) => {
    setActorState(a);
    localStorage.setItem(`chaipot:actor:${id}`, a);
  };

  /** POST to a pot endpoint; updates the pot from the response. Throws on error. */
  const call = useCallback(
    async (path: string, body: Record<string, unknown> = {}) => {
      const r = await fetch(`/api/pots/${id}/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actor, ...body }),
      });
      const d = await r.json().catch(() => ({ error: "Bad response" }));
      if (d.pot) setPot(d.pot);
      if (!r.ok) throw new Error(d.error || "Request failed");
      return d;
    },
    [id, actor],
  );

  /** Re-read the pot (used while a slow agent call is in flight or after a dropped response). */
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/pots/${id}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.pot) setPot(d.pot);
    return (d.pot ?? null) as Pot | null;
  }, [id]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 4000);
  };

  if (error)
    return (
      <main>
        <div className="notice bad">{error}</div>
        <p style={{ marginTop: 12 }}>
          <Link href="/">Back home</Link>
        </p>
      </main>
    );
  if (!pot) return <main className="muted">Brewing…</main>;

  const pending = pot.spends.filter((s) => s.status === "pending_approval").length;

  return (
    <main>
      <header className="top">
        <Link className="brand" href="/">
          <img src="/icon.svg" alt="" /> Chai Pot
        </Link>
        <select value={actor} onChange={(e) => setActor(e.target.value)} style={{ width: "auto" }} aria-label="Acting as">
          {pot.members.map((m) => (
            <option key={m.id} value={m.id}>
              You are {m.name}
            </option>
          ))}
        </select>
      </header>

      {pot.isDemo && (
        <div className="notice" style={{ marginBottom: 10 }}>
          Demo pot. Entries marked <span className="badge sample">sample</span> are seeded; anything you do here runs for real against PayPal
          sandbox and Gemini. Switch &ldquo;You are&rdquo; to act as another member.{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              call("reset").then(() => flash("Demo reset")).catch((er) => flash(er.message));
            }}
          >
            Reset demo
          </a>
        </div>
      )}
      {config && !config.paypal && (
        <div className="notice bad" style={{ marginBottom: 10 }}>
          PayPal sandbox not configured on this deployment. Funding, payouts and refunds are disabled. Nothing is faked.
        </div>
      )}
      {config && !config.ai && (
        <div className="notice bad" style={{ marginBottom: 10 }}>
          AI agent not configured (GEMINI_API_KEY missing). Receipt reading and requests are disabled.
        </div>
      )}

      <Summary pot={pot} />

      <nav className="tabs">
        {(
          [
            ["pot", "Pot"],
            ["agent", "Agent"],
            ["bills", pending ? `Bills (${pending})` : "Bills"],
            ["audit", "Audit"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </nav>

      {toast && <div className="notice good" style={{ marginBottom: 10 }}>{toast}</div>}

      {tab === "pot" && <PotTab pot={pot} actor={actor} config={config} call={call} flash={flash} />}
      {tab === "agent" && <AgentTab key={actor} pot={pot} actor={actor} config={config} call={call} refresh={refresh} flash={flash} goBills={() => setTab("bills")} />}
      {tab === "bills" && <BillsTab pot={pot} actor={actor} call={call} flash={flash} />}
      {tab === "audit" && <AuditTab pot={pot} />}
    </main>
  );
}

type Call = (path: string, body?: Record<string, unknown>) => Promise<any>;
const name = (pot: Pot, id: string) => (id === "agent" ? "Agent" : pot.members.find((m) => m.id === id)?.name ?? id);

function Summary({ pot }: { pot: Pot }) {
  const l = computeLedger(pot);
  const target = pot.contributionTarget * pot.members.length;
  const pct = target ? Math.min(100, Math.round((l.totals.contributed / target) * 100)) : 0;
  const today = spentOnDay(pot, Date.now());
  return (
    <div className="card hero-card">
      <div className="row">
        <div>
          <div className="muted">{pot.name}</div>
          <div className="big">{formatMoney(l.totals.potBalance, pot.currency)}</div>
          <div className="muted small">in the pot · {pot.members.length} members</div>
        </div>
        <div style={{ textAlign: "right" }} className="small">
          <div>Agent today</div>
          <strong>
            {formatMoney(today, pot.currency)} / {formatMoney(pot.policy.dailyCap, pot.currency)}
          </strong>
        </div>
      </div>
      <div className="progress" style={{ marginTop: 10 }}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>
        {formatMoney(l.totals.contributed, pot.currency)} of {formatMoney(target, pot.currency)} contributed ({pct}%)
      </div>
    </div>
  );
}

function PotTab({ pot, actor, config, call, flash }: { pot: Pot; actor: string; config: Config | null; call: Call; flash: (m: string) => void }) {
  const l = computeLedger(pot);
  const me = l.members.find((m) => m.memberId === actor);
  const [amount, setAmount] = useState("");
  useEffect(() => {
    setAmount(((me?.targetRemaining || pot.contributionTarget || 1000) / 100).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor]);
  const myPayments = pot.contributions.filter((c) => c.memberId === actor && c.method === "paypal");
  const amountRef = useMemo(() => ({ v: amount }), [amount]);

  return (
    <div>
      <h2>Chip in</h2>
      <div className="card stack">
        <div className="row">
          <span>
            Your share left: <strong>{formatMoney(me?.targetRemaining ?? 0, pot.currency)}</strong>
          </span>
        </div>
        <div>
          <label>Amount ({pot.currency})</label>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        {config?.paypal ? (
          <PayPalFund
            key={actor}
            clientId={config.paypalClientId}
            currency={pot.currency}
            amount={amount}
            createOrder={async () => (await call("paypal/order", { amount: amountRef.v })).orderId}
            capture={async (orderId) => {
              await call("paypal/capture", { orderId });
              flash("Payment captured and added to the pot");
            }}
          />
        ) : (
          <p className="muted small">PayPal sandbox not configured.</p>
        )}
        {config?.usdc && pot.usdcTreasury && pot.currency === "USD" && (
          <UsdcFund
            potId={pot.id}
            treasury={pot.usdcTreasury}
            amount={amount}
            onTx={async (txHash) => {
              await call("usdc", { txHash });
              flash("USDC contribution verified on Base");
            }}
          />
        )}
      </div>

      <h2>Ledger</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th className="num">In</th>
              <th className="num">Spent</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {l.members.map((m) => (
              <tr key={m.memberId}>
                <td>
                  {m.name}
                  {m.memberId === actor && <span className="muted"> (you)</span>}
                </td>
                <td className="num">{formatMoney(m.contributed - m.refunded, pot.currency)}</td>
                <td className="num">{formatMoney(m.spent, pot.currency)}</td>
                <td className={`num ${m.balance < 0 ? "neg" : ""}`}>{formatMoney(m.balance, pot.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: 8 }}>
          Negative balance = that member&apos;s share of bills is more than they put in.
        </p>
      </div>

      <h2>Rules the agent follows</h2>
      <div className="card small">
        <div className="row">
          <span>Per-bill cap</span>
          <strong>{formatMoney(pot.policy.perBillCap, pot.currency)}</strong>
        </div>
        <div className="row">
          <span>Daily cap</span>
          <strong>{formatMoney(pot.policy.dailyCap, pot.currency)}</strong>
        </div>
        <div className="row">
          <span>Above a cap</span>
          <strong>
            {pot.policy.approvalsRequired} approval{pot.policy.approvalsRequired === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="row wrap" style={{ marginTop: 6 }}>
          <span>Allowed</span>
          <span className="chips">
            {pot.policy.allowedCategories.map((c) => (
              <span key={c} className="badge">
                {c}
              </span>
            ))}
          </span>
        </div>
      </div>

      {myPayments.length > 0 && (
        <>
          <h2>Your PayPal payments</h2>
          {myPayments.map((c) => {
            const max = refundableAmount(pot, c.id);
            const refunded = pot.refunds.filter((r) => r.contributionId === c.id).reduce((s, r) => s + r.amount, 0);
            return (
              <div className="card row" key={c.id}>
                <div>
                  <strong>{formatMoney(c.amount, pot.currency)}</strong>
                  <div className="muted small">
                    Capture {c.ref}
                    {refunded > 0 && ` · ${formatMoney(refunded, pot.currency)} refunded`}
                  </div>
                  {pot.refunds
                    .filter((r) => r.contributionId === c.id)
                    .map((r) => (
                      <div className="muted small" key={r.id}>
                        Refund {r.ref} · {formatMoney(r.amount, pot.currency)} · {r.status}
                      </div>
                    ))}
                </div>
                <RefundControl key={`${c.id}-${max}`} max={max} currency={pot.currency} call={call} flash={flash} contributionId={c.id} />
              </div>
            );
          })}
        </>
      )}

      <h2>Contributions</h2>
      {pot.contributions.length === 0 && <p className="muted">Nobody has chipped in yet.</p>}
      {[...pot.contributions].reverse().map((c) => (
        <div className="card row" key={c.id}>
          <div>
            <strong>{name(pot, c.memberId)}</strong> {c.sample && <span className="badge sample">sample</span>}
            <div className="muted small">
              {c.method === "paypal" ? `PayPal · ${c.ref}` : c.method === "usdc" ? `USDC on Base · ${c.ref.slice(0, 10)}…` : "Seeded"} ·{" "}
              {new Date(c.createdAt).toLocaleString()}
            </div>
          </div>
          <span className="pos">+{formatMoney(c.amount, pot.currency)}</span>
        </div>
      ))}
    </div>
  );
}

/** Partial or full refund of one PayPal contribution, with an inline confirm step. */
function RefundControl({
  max,
  currency,
  contributionId,
  call,
  flash,
}: {
  max: number;
  currency: string;
  contributionId: string;
  call: Call;
  flash: (m: string) => void;
}) {
  const [amt, setAmt] = useState((max / 100).toFixed(2));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (max <= 0) return <span className="muted small">Nothing left to refund</span>;
  const minor = /^\d+(\.\d{1,2})?$/.test(amt.trim()) ? Math.round(Number(amt) * 100) : NaN;
  const valid = Number.isFinite(minor) && minor > 0 && minor <= max;
  async function go() {
    setBusy(true);
    setErr("");
    try {
      await call("refunds", { contributionId, amount: amt.trim() });
      flash(`Refunded ${formatMoney(minor, currency)} via PayPal`);
    } catch (e) {
      setErr((e as Error).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="refund">
      <div className="row" style={{ gap: 6 }}>
        <input
          aria-label="Refund amount"
          inputMode="decimal"
          value={amt}
          disabled={busy}
          onChange={(e) => {
            setAmt(e.target.value);
            setConfirming(false);
          }}
        />
        {confirming ? (
          <button className="btn small" disabled={busy || !valid} onClick={go}>
            {busy ? "Refunding…" : `Confirm ${formatMoney(minor, currency)}`}
          </button>
        ) : (
          <button className="btn small secondary" disabled={!valid} onClick={() => setConfirming(true)}>
            Refund
          </button>
        )}
      </div>
      <div className="muted small">{err ? <span className="neg">{err}</span> : `Up to ${formatMoney(max, currency)}`}</div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<{ data: string; mime: string }> {
  // Downscale large photos in the browser so uploads stay small.
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { data: btoa(s), mime: file.type || "image/jpeg" };
  }
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { data: url.split(",")[1], mime: "image/jpeg" };
}

const EXAMPLES = [
  "Pay the $24 dinner at Saravana Bhavan to sb-syijz53572713@personal.example.com, split between everyone",
  "Book the airport cab, ₹1,800, pay sb-syijz53572713@personal.example.com",
  "Pay $95 for the villa deposit to sb-syijz53572713@personal.example.com",
  "Buy a $30 speaker from sb-syijz53572713@personal.example.com",
];

function AgentTab({
  pot,
  actor,
  config,
  call,
  refresh,
  flash,
  goBills,
}: {
  pot: Pot;
  actor: string;
  config: Config | null;
  call: Call;
  refresh: () => Promise<Pot | null>;
  flash: (m: string) => void;
  goBills: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [payee, setPayee] = useState("");
  const [split, setSplit] = useState<string[]>(pot.members.map((m) => m.id));
  const disabled = !config?.ai;

  const receipt = pot.audit.find((a) => a.id === receiptId);
  const lastAgent = pot.audit.find((a) => a.actor === "agent" && ["policy_decision", "agent_needs_info"].includes(a.kind));

  async function ask() {
    setBusy("Thinking…");
    setErr("");
    try {
      const d = await call("agent/request", { text });
      if (d.spendId) setText("");
      flash(d.spendId ? "Agent decided; see below" : "Agent needs more info");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // A receipt this member uploaded recently that has not been sent for payment yet. Lets the
  // result show up even if the page was reloaded or the response was dropped mid-read.
  const pendingReceipt = (since: number) =>
    pot.audit.find(
      (a) =>
        a.kind === "agent_receipt" &&
        a.at >= since &&
        (a.data as { requestedById?: string; spendId?: string } | undefined)?.requestedById === actor &&
        !(a.data as { spendId?: string } | undefined)?.spendId,
    );
  useEffect(() => {
    if (receiptId || busy) return;
    const r = pendingReceipt(Date.now() - 30 * 60_000);
    if (r) setReceiptId(r.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pot.audit, actor]);

  // Show elapsed time while the agent reads, so a slow model call doesn't look frozen.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) return setElapsed(0);
    const t0 = Date.now();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function upload(f: File | undefined, input?: HTMLInputElement) {
    if (!f) return;
    const started = Date.now() - 5_000;
    setBusy("Reading receipt…");
    setErr("");
    setReceiptId("");
    // Poll the pot while the model works: if the response is lost (timeout, flaky network),
    // the parsed receipt still appears as soon as the server has saved it.
    let found = "";
    const poll = setInterval(async () => {
      const p = await refresh().catch(() => null);
      const hit = p?.audit.find(
        (a) => a.kind === "agent_receipt" && a.at >= started && (a.data as { requestedById?: string } | undefined)?.requestedById === actor,
      );
      if (hit) found = hit.id;
    }, 6000);
    try {
      const { data, mime } = await fileToBase64(f);
      const d = await call("agent/receipt", { image: data, mimeType: mime });
      setReceiptId(d.receiptId);
    } catch (e) {
      const p = found ? null : await refresh().catch(() => null);
      const hit =
        found ||
        p?.audit.find(
          (a) => a.kind === "agent_receipt" && a.at >= started && (a.data as { requestedById?: string } | undefined)?.requestedById === actor,
        )?.id;
      if (hit) setReceiptId(hit);
      else setErr((e as Error).message === "Failed to fetch" ? "Lost the connection while the agent was reading. Try the photo again." : (e as Error).message);
    } finally {
      clearInterval(poll);
      setBusy("");
      if (input) input.value = "";
    }
  }

  async function payReceipt() {
    setBusy("Checking policy…");
    setErr("");
    try {
      await call("agent/pay-receipt", { receiptId, payeeEmail: payee, splitAmong: split });
      setReceiptId("");
      flash("Agent decided; see below");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const rd = receipt?.data as
    | { receipt: { merchant: string; currency: string; total: number; date?: string | null }; amount: number; items: { name: string; quantity: number; total: number }[]; category: string; original?: { amount: number; currency: string } }
    | undefined;

  return (
    <div>
      <h2>Ask the agent to pay</h2>
      <div className="card stack">
        <textarea
          placeholder="e.g. Pay the $24 dinner at Saravana to host@example.com"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => setText(ex)} disabled={disabled}>
              {ex.split(" to ")[0].split(", pay")[0].split(" from ")[0]}
            </button>
          ))}
        </div>
        <button className="btn" disabled={disabled || !!busy || text.trim().length < 4} onClick={ask}>
          {busy || "Send to agent"}
        </button>
      </div>

      <h2>Or snap a receipt</h2>
      <div className="card stack">
        <input type="file" accept="image/*" capture="environment" disabled={disabled || !!busy} onChange={(e) => upload(e.target.files?.[0], e.currentTarget)} />
        {busy === "Reading receipt…" && (
          <p className="muted small" role="status">
            Reading receipt… {elapsed}s. The agent itemizes every line; this can take up to a minute.
          </p>
        )}
        <p className="muted small">The agent itemizes it and suggests a split. You add who gets paid.</p>
        {rd && (
          <div className="stack">
            <div className="row">
              <strong>{rd.receipt.merchant}</strong>
              <span className="badge">{rd.category}</span>
            </div>
            <table>
              <tbody>
                {rd.items.map((i, k) => (
                  <tr key={k}>
                    <td>
                      {i.quantity > 1 ? `${i.quantity} × ` : ""}
                      {i.name}
                    </td>
                    <td className="num">{formatMoney(i.total, pot.currency)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Total</strong>
                    {rd.original && <span className="muted small"> ({formatMoney(rd.original.amount, rd.original.currency)})</span>}
                  </td>
                  <td className="num">
                    <strong>{formatMoney(rd.amount, pot.currency)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            {receipt?.reasoning && <div className="reasoning">{receipt.reasoning}</div>}
            <label>Split between</label>
            <div className="chips">
              {pot.members.map((m) => (
                <button
                  key={m.id}
                  className={`chip ${split.includes(m.id) ? "on" : ""}`}
                  onClick={() => setSplit((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                >
                  {m.name} {split.includes(m.id) && formatMoney(splitEqual(rd.amount, split)[m.id] ?? 0, pot.currency)}
                </button>
              ))}
            </div>
            <label>Pay to (PayPal email)</label>
            <input type="email" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="merchant@example.com" />
            <button className="btn" disabled={!!busy || !payee || !split.length} onClick={payReceipt}>
              {busy || "Ask agent to pay this"}
            </button>
          </div>
        )}
      </div>

      {err && <div className="notice bad">{err}</div>}

      {lastAgent && (
        <>
          <h2>Latest agent decision</h2>
          <AuditCard pot={pot} e={lastAgent} />
          {lastAgent.decision === "needs_approval" && (
            <button className="btn secondary" onClick={goBills}>
              Go to approvals
            </button>
          )}
        </>
      )}
    </div>
  );
}

const statusBadge: Record<Spend["status"], [string, string]> = {
  paid: ["paid", "good"],
  pending_approval: ["needs approval", "warn"],
  rejected: ["rejected", "bad"],
  failed: ["payout failed", "bad"],
};

function BillsTab({ pot, actor, call, flash }: { pot: Pot; actor: string; call: Call; flash: (m: string) => void }) {
  const [busy, setBusy] = useState("");
  const act = (spendId: string, action: string) => {
    setBusy(spendId + action);
    call("spends", { spendId, action })
      .then(() => flash(action === "approve" ? "Approval recorded" : action === "sync" ? "Payout status updated" : "Done"))
      .catch((e) => flash(e.message))
      .finally(() => setBusy(""));
  };
  if (!pot.spends.length) return <p className="muted">No bills yet. Ask the agent to pay one.</p>;
  return (
    <div>
      {pot.spends.map((s) => {
        const [label, tone] = statusBadge[s.status];
        const canApprove = s.status === "pending_approval" && s.requestedBy !== actor && !s.approvals.includes(actor);
        return (
          <div className="card stack" key={s.id}>
            <div className="row">
              <div>
                <strong>{s.description}</strong>
                <div className="muted small">
                  to {s.payeeName ? `${s.payeeName} · ` : ""}
                  {s.payeeEmail} · {s.category} · asked by {name(pot, s.requestedBy)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>{formatMoney(s.amount, pot.currency)}</strong>
                <div>
                  <span className={`badge ${tone}`}>{label}</span> {s.sample && <span className="badge sample">sample</span>}
                </div>
              </div>
            </div>
            {s.original && (
              <div className="muted small">
                Requested as {formatMoney(s.original.amount, s.original.currency)} (indicative rate {s.original.rate.toFixed(4)})
              </div>
            )}
            <div className="muted small">
              Split: {Object.entries(s.splits).map(([id, v]) => `${name(pot, id)} ${formatMoney(v, pot.currency)}`).join(" · ")}
            </div>
            {s.status === "pending_approval" && (
              <div className="muted small">
                Approvals {s.approvals.length}/{pot.policy.approvalsRequired}
                {s.approvals.length > 0 && `: ${s.approvals.map((a) => name(pot, a)).join(", ")}`}
              </div>
            )}
            {s.payout && (
              <div className="muted small">
                PayPal payout {s.payout.batchId} · {s.payout.status}
                {s.payout.itemStatus && ` · item ${s.payout.itemStatus}`}
              </div>
            )}
            {s.error && <div className="neg small">{s.error}</div>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              {s.status === "pending_approval" && (
                <>
                  <button className="btn small secondary" disabled={!!busy} onClick={() => act(s.id, "reject")}>
                    Reject
                  </button>
                  <button className="btn small" disabled={!!busy || !canApprove} onClick={() => act(s.id, "approve")}
                    title={s.requestedBy === actor ? "Switch member: requesters can't approve their own bill" : ""}>
                    {busy === s.id + "approve" ? "Approving…" : s.requestedBy === actor ? "Your request" : s.approvals.includes(actor) ? "Approved" : "Approve"}
                  </button>
                </>
              )}
              {s.status === "failed" && (
                <button className="btn small" disabled={!!busy} onClick={() => act(s.id, "retry")}>
                  Retry payout
                </button>
              )}
              {s.payout && !s.sample && (
                <button className="btn small secondary" disabled={!!busy} onClick={() => act(s.id, "sync")}>
                  Refresh status
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const decisionBadge: Record<string, [string, string]> = {
  auto_pay: ["auto-pay", "good"],
  needs_approval: ["needs approval", "warn"],
  reject: ["rejected", "bad"],
};

function AuditCard({ pot, e }: { pot: Pot; e: AuditEntry }) {
  const d = e.decision ? decisionBadge[e.decision] : null;
  const data = e.data as Record<string, unknown> | undefined;
  return (
    <div className="card">
      <div className="row">
        <span className="small">
          <strong>{name(pot, e.actor)}</strong> · {new Date(e.at).toLocaleString()}
        </span>
        <span>
          {d && <span className={`badge ${d[1]}`}>{d[0]}</span>} {e.sample && <span className="badge sample">sample</span>}
        </span>
      </div>
      <p style={{ marginTop: 4 }}>{e.summary}</p>
      {typeof data?.request === "string" && <p className="muted small">&ldquo;{data.request}&rdquo;</p>}
      {e.reasoning && <div className="reasoning">🤖 {e.reasoning}</div>}
      {e.checks && (
        <ul className="checks">
          {e.checks.map((c) => (
            <li key={c.name}>
              {c.ok ? "✅" : "⚠️"} <strong>{c.name}:</strong> {c.detail}
            </li>
          ))}
        </ul>
      )}
      {data && (data.interpretation || data.receipt) ? (
        <details style={{ marginTop: 6 }}>
          <summary>Model output ({String(data.model ?? "")})</summary>
          <pre>{JSON.stringify(data.interpretation ?? data.receipt, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function AuditTab({ pot }: { pot: Pot }) {
  return (
    <div>
      <p className="muted small">Every agent interpretation, policy check, approval, payout and refund, newest first.</p>
      {pot.audit.map((e) => (
        <AuditCard key={e.id} pot={pot} e={e} />
      ))}
    </div>
  );
}
