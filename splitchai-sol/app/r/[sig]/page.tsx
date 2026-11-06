import Link from "next/link";
import Header from "@/components/Header";
import { connection } from "@/lib/chain";
import { MINT, TREASURY, explorerAddr, explorerTx } from "@/lib/config";
import { formatUsdc } from "@/lib/money";
import { parseMemo } from "@/lib/tx";

export const dynamic = "force-dynamic";
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

/** On-chain receipt: reads the transaction straight from Solana devnet and explains each instruction. */
export default async function Receipt({ params }: { params: Promise<{ sig: string }> }) {
  const { sig } = await params;
  const ok = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig);
  const tx = ok ? await connection.getParsedTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null) : null;
  if (!tx) {
    return (<><Header /><main className="wrap"><div className="card"><h2>Transaction not found on devnet</h2><p className="muted">It may still be confirming. <Link href="/">Home</Link></p></div></main></>);
  }
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const owner: Record<string, string> = {};
  for (const b of [...(tx.meta?.preTokenBalances ?? []), ...(tx.meta?.postTokenBalances ?? [])]) if (b.owner) owner[keys[b.accountIndex]] = b.owner;
  const name = (ata: string) => {
    const o = owner[ata];
    if (o === TREASURY) return "SplitChai treasury";
    return o ? short(o) : short(ata);
  };
  let memo: ReturnType<typeof parseMemo> = null;
  const rows = tx.transaction.message.instructions.map((ix, i) => {
    const p = "parsed" in ix ? (ix as any) : null;
    const prog = p?.program ?? ("programId" in ix ? ix.programId.toBase58() : "");
    if (p?.program === "spl-token" && p.parsed?.type === "transferChecked") {
      const inf = p.parsed.info;
      return { i, prog: "SPL Token", what: "TransferChecked", detail: `${formatUsdc(Number(inf.tokenAmount.amount))} ${inf.mint === MINT ? "tUSDC" : "tokens"} · ${name(inf.source)} → ${name(inf.destination)}`, hi: true };
    }
    if (p?.program === "spl-associated-token-account") return { i, prog: "Associated Token", what: p.parsed?.type ?? "create", detail: `account for ${short(p.parsed?.info?.wallet ?? "")}` };
    if (p?.program === "spl-memo") { memo = parseMemo(String(p.parsed)); return { i, prog: "Memo", what: "memo", detail: String(p.parsed), hi: true }; }
    if (prog.startsWith("ComputeBudget")) return { i, prog: "Compute Budget", what: "setComputeUnitLimit", detail: "" };
    return { i, prog: p?.program ?? short(prog), what: p?.parsed?.type ?? "instruction", detail: "" };
  });
  const transfers = rows.filter((r) => r.what === "TransferChecked").length;
  const when = tx.blockTime ? new Date(tx.blockTime * 1000).toUTCString() : "";
  return (
    <>
      <Header />
      <main className="wrap">
        <section className={`card receipt`}>
          <h1 style={{ margin: 0 }}>{tx.meta?.err ? "❌ Failed transaction" : "✅ On-chain receipt"}</h1>
          <p className="muted">Read live from Solana devnet · slot {tx.slot.toLocaleString()} · {when}</p>
          <p><b>{transfers}</b> token transfer{transfers === 1 ? "" : "s"} in <b>one atomic transaction</b> · network fee <b>◎{((tx.meta?.fee ?? 0) / 1e9).toFixed(6)}</b> ({(tx.meta?.fee ?? 0).toLocaleString()} lamports)
            {memo && <> · group <Link href={`/g/${(memo as { groupId: string }).groupId}`}>{(memo as { groupId: string }).groupId}</Link></>}</p>
          <p className="muted">Signature <code>{short(sig)}</code> · <a href={explorerTx(sig)} target="_blank" rel="noreferrer">Solana Explorer ↗</a> · signer <a href={explorerAddr(keys[0])} target="_blank" rel="noreferrer">{short(keys[0])}</a></p>
        </section>
        <section className="card">
          <h2>Instructions</h2>
          <ul className="exp">
            {rows.map((r) => (
              <li key={r.i}>
                <div><span className="muted">{r.i + 1}.</span> <b className={r.hi ? "pos" : ""}>{r.what}</b> <span className="muted">· {r.prog}</span></div>
                <div className="right"><span>{r.detail}</span></div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
