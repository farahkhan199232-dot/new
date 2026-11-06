import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { parseMemo } from "./tx";
import type { Group, Settlement } from "./types";

/** The parts of a jsonParsed transaction we rely on (kept small so it is easy to unit test). */
export interface ParsedIx {
  program?: string;
  programId?: string;
  parsed?: unknown;
}
export interface ParsedTxLite {
  slot: number;
  blockTime?: number | null;
  err: unknown;
  fee?: number; // network fee in lamports
  instructions: ParsedIx[];
}

export type VerifyResult =
  | { ok: true; settlements: Settlement[]; fee: number }
  | { ok: false; error: string };

/**
 * Check a confirmed devnet transaction against a group and turn each member-to-member
 * TransferChecked into a Settlement. Rejects failed txs, wrong group memo, wrong mint,
 * transfers from/to non-members, and signatures already recorded.
 */
export function extractSettlements(
  g: Group,
  sig: string,
  tx: ParsedTxLite,
  mintStr: string,
  treasuryStr?: string,
): VerifyResult {
  if (tx.err) return { ok: false, error: "transaction failed on-chain" };
  if (g.settlements.some((s) => s.signature === sig)) return { ok: false, error: "already recorded" };
  const memoIx = tx.instructions.find((i) => i.program === "spl-memo" && typeof i.parsed === "string");
  const memo = memoIx ? parseMemo(memoIx.parsed as string) : null;
  if (!memo || memo.groupId !== g.id) return { ok: false, error: "memo does not tag this group" };

  const mint = new PublicKey(mintStr);
  const byWallet = new Map<string, string>();
  const byAta = new Map<string, string>();
  for (const m of g.members) {
    if (!m.wallet) continue;
    byWallet.set(m.wallet, m.id);
    byAta.set(getAssociatedTokenAddressSync(mint, new PublicKey(m.wallet)).toBase58(), m.id);
  }
  const treasuryAta = treasuryStr ? getAssociatedTokenAddressSync(mint, new PublicKey(treasuryStr)).toBase58() : null;

  const out: Settlement[] = [];
  let fee = 0;
  for (const ix of tx.instructions) {
    if (ix.program !== "spl-token") continue;
    const p = ix.parsed as { type?: string; info?: Record<string, any> } | undefined;
    if (!p || (p.type !== "transferChecked" && p.type !== "transfer")) continue;
    const info = p.info ?? {};
    if (p.type !== "transferChecked") return { ok: false, error: "only TransferChecked is accepted" };
    if (info.mint !== mintStr) return { ok: false, error: "wrong token mint" };
    const amount = Number(info.tokenAmount?.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: "bad amount" };
    if (treasuryAta && info.destination === treasuryAta) {
      fee += amount;
      continue;
    }
    const from = byWallet.get(info.authority ?? info.multisigAuthority);
    const to = byAta.get(info.destination);
    if (!from) return { ok: false, error: "payer wallet is not a member of this group" };
    if (!to) return { ok: false, error: "recipient is not a member of this group" };
    if (from === to) return { ok: false, error: "self transfer" };
    out.push({
      id: `${sig.slice(0, 16)}-${out.length}`,
      from,
      to,
      amount,
      fee: 0,
      signature: sig,
      slot: tx.slot,
      blockTime: tx.blockTime ?? null,
      verifiedAt: Date.now(),
    });
  }
  if (out.length === 0) return { ok: false, error: "no member-to-member transfer found" };
  // attribute the fee pro rata to legs (display only)
  const total = out.reduce((s, x) => s + x.amount, 0);
  let left = fee;
  out.forEach((s, i) => {
    s.fee = i === out.length - 1 ? left : Math.floor((fee * s.amount) / total);
    left -= s.fee;
  });
  return { ok: true, settlements: out, fee };
}
