import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { feeFor } from "./money";

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const MEMO_PREFIX = "splitchai";

export interface SettleLeg {
  creditor: PublicKey; // creditor wallet (owner of the destination token account)
  amount: number; // base units
}

export interface SettleParams {
  payer: PublicKey;
  mint: PublicKey;
  decimals: number;
  legs: SettleLeg[];
  feeBps: number;
  treasury?: PublicKey; // treasury wallet; fee goes to its ATA
  groupId: string;
  nonce: string;
}

/** Memo text tagging the group and a per-settle nonce: "splitchai|g=<id>|n=<nonce>|legs=<k>". */
export function settleMemo(groupId: string, nonce: string, legs: number): string {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(groupId) || !/^[A-Za-z0-9_-]{1,40}$/.test(nonce)) throw new Error("bad memo ids");
  return `${MEMO_PREFIX}|g=${groupId}|n=${nonce}|legs=${legs}`;
}

export function parseMemo(text: string): { groupId: string; nonce: string; legs: number } | null {
  // RPC returns memo logs like "[len] splitchai|g=..." in some views; find our prefix anywhere.
  const m = text.match(/splitchai\|g=([A-Za-z0-9_-]+)\|n=([A-Za-z0-9_-]+)\|legs=(\d+)/);
  return m ? { groupId: m[1], nonce: m[2], legs: Number(m[3]) } : null;
}

/**
 * One atomic transaction that settles every leg at once:
 *  - create the creditor's token account if missing (idempotent, payer pays rent)
 *  - TransferChecked payer -> creditor for each leg
 *  - one TransferChecked payer -> treasury for the summed 0.3% fee (when enabled)
 *  - a Memo (signed by the payer) tagging group + nonce, used for server-side verification
 * Either everything lands or nothing does.
 */
export function buildSettleInstructions(p: SettleParams): TransactionInstruction[] {
  if (p.legs.length === 0) throw new Error("nothing to settle");
  if (p.legs.length > 8) throw new Error("too many legs for one transaction");
  const ixs: TransactionInstruction[] = [ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 + 40_000 * p.legs.length })];
  const source = getAssociatedTokenAddressSync(p.mint, p.payer);
  let feeTotal = 0;
  for (const leg of p.legs) {
    if (!Number.isSafeInteger(leg.amount) || leg.amount <= 0) throw new Error("leg amount must be positive");
    if (leg.creditor.equals(p.payer)) throw new Error("cannot pay yourself");
    const dest = getAssociatedTokenAddressSync(p.mint, leg.creditor);
    ixs.push(createAssociatedTokenAccountIdempotentInstruction(p.payer, dest, leg.creditor, p.mint));
    ixs.push(createTransferCheckedInstruction(source, p.mint, dest, p.payer, BigInt(leg.amount), p.decimals));
    feeTotal += feeFor(leg.amount, p.feeBps);
  }
  if (feeTotal > 0 && p.treasury) {
    const tAta = getAssociatedTokenAddressSync(p.mint, p.treasury);
    ixs.push(createAssociatedTokenAccountIdempotentInstruction(p.payer, tAta, p.treasury, p.mint));
    ixs.push(createTransferCheckedInstruction(source, p.mint, tAta, p.payer, BigInt(feeTotal), p.decimals));
  }
  ixs.push(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: p.payer, isSigner: true, isWritable: false }],
      data: Buffer.from(settleMemo(p.groupId, p.nonce, p.legs.length), "utf8"),
    }),
  );
  return ixs;
}

export function buildSettleTx(p: SettleParams, recentBlockhash: string): Transaction {
  const tx = new Transaction({ feePayer: p.payer, recentBlockhash });
  tx.add(...buildSettleInstructions(p));
  return tx;
}

export function totalFee(legs: { amount: number }[], feeBps: number): number {
  return legs.reduce((s, l) => s + feeFor(l.amount, feeBps), 0);
}
