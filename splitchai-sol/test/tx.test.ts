import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { buildSettleTx, buildSettleInstructions, MEMO_PROGRAM_ID, parseMemo, settleMemo, totalFee } from "@/lib/tx";
import { extractSettlements, type ParsedTxLite } from "@/lib/verify";
import type { Group } from "@/lib/types";

const mint = Keypair.generate().publicKey;
const payer = Keypair.generate().publicKey;
const alice = Keypair.generate().publicKey;
const bob = Keypair.generate().publicKey;
const treasury = Keypair.generate().publicKey;

describe("settle tx builder", () => {
  it("builds ATA-create + TransferChecked per leg, one fee transfer, and a memo", () => {
    const ixs = buildSettleInstructions({ payer, mint, decimals: 6, feeBps: 30, treasury, groupId: "grp1", nonce: "n1",
      legs: [{ creditor: alice, amount: 10_000_000 }, { creditor: bob, amount: 5_000_000 }] });
    // compute budget, (ata, transfer) x2, (ata, fee transfer), memo
    expect(ixs.length).toBe(1 + 4 + 2 + 1);
    const transfers = ixs.filter((i) => i.programId.equals(TOKEN_PROGRAM_ID));
    expect(transfers.length).toBe(3);
    for (const t of transfers) {
      expect(t.data[0]).toBe(12); // TransferChecked
      expect(t.data[9]).toBe(6); // decimals
      expect(t.keys[1].pubkey.equals(mint)).toBe(true);
      expect(t.keys[3].pubkey.equals(payer)).toBe(true);
    }
    const amt = (i: number) => transfers[i].data.readBigUInt64LE(1);
    expect(amt(0)).toBe(10_000_000n);
    expect(amt(1)).toBe(5_000_000n);
    expect(amt(2)).toBe(45_000n); // 0.3% of 15
    expect(transfers[0].keys[2].pubkey.equals(getAssociatedTokenAddressSync(mint, alice))).toBe(true);
    expect(transfers[2].keys[2].pubkey.equals(getAssociatedTokenAddressSync(mint, treasury))).toBe(true);
    expect(ixs.filter((i) => i.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).length).toBe(3);
    const memo = ixs[ixs.length - 1];
    expect(memo.programId.equals(MEMO_PROGRAM_ID)).toBe(true);
    expect(memo.data.toString()).toBe("splitchai|g=grp1|n=n1|legs=2");
    expect(totalFee([{ amount: 10_000_000 }, { amount: 5_000_000 }], 30)).toBe(45_000);
  });
  it("skips the fee leg when fee is off and fits in one legacy tx", () => {
    const tx = buildSettleTx({ payer, mint, decimals: 6, feeBps: 0, treasury, groupId: "grp1", nonce: "n1",
      legs: [alice, bob, Keypair.generate().publicKey, Keypair.generate().publicKey].map((c) => ({ creditor: c, amount: 1 })) }, PublicKey.default.toBase58());
    expect(tx.instructions.filter((i) => i.programId.equals(TOKEN_PROGRAM_ID)).length).toBe(4);
    const size = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
    expect(size).toBeLessThanOrEqual(1232);
  });
  it("rejects bad input", () => {
    const base = { payer, mint, decimals: 6, feeBps: 30, treasury, groupId: "g", nonce: "n" };
    expect(() => buildSettleInstructions({ ...base, legs: [] })).toThrow();
    expect(() => buildSettleInstructions({ ...base, legs: [{ creditor: payer, amount: 1 }] })).toThrow(/yourself/);
    expect(() => buildSettleInstructions({ ...base, legs: [{ creditor: alice, amount: 0 }] })).toThrow();
    expect(() => settleMemo("bad id!", "n", 1)).toThrow();
  });
  it("memo round-trips", () => {
    expect(parseMemo("[29] " + settleMemo("abc_DEF-1", "xyz", 3))).toEqual({ groupId: "abc_DEF-1", nonce: "xyz", legs: 3 });
    expect(parseMemo("hello")).toBeNull();
  });
});

describe("server-side verification", () => {
  const g: Group = { id: "grp1", name: "t", createdAt: 0, feeBps: 30, expenses: [], settlements: [],
    members: [{ id: "p", name: "Payer", wallet: payer.toBase58() }, { id: "a", name: "Alice", wallet: alice.toBase58() }, { id: "x", name: "NoWallet" }] };
  const tc = (dest: PublicKey, amount: number, m = mint, auth = payer) => ({ program: "spl-token", parsed: { type: "transferChecked", info: {
    source: getAssociatedTokenAddressSync(m, auth).toBase58(), destination: getAssociatedTokenAddressSync(m, dest).toBase58(), mint: m.toBase58(),
    authority: auth.toBase58(), tokenAmount: { amount: String(amount), decimals: 6 } } } });
  const memo = { program: "spl-memo", parsed: "splitchai|g=grp1|n=n1|legs=1" };
  const tx = (ins: any[], err: unknown = null): ParsedTxLite => ({ slot: 5, blockTime: 1, err, instructions: ins });

  it("accepts a valid settle and attributes the fee", () => {
    const r = extractSettlements(g, "sig1", tx([tc(alice, 10_000_000), tc(treasury, 30_000), memo]), mint.toBase58(), treasury.toBase58());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.settlements).toHaveLength(1);
      expect(r.settlements[0]).toMatchObject({ from: "p", to: "a", amount: 10_000_000, fee: 30_000, signature: "sig1", slot: 5 });
    }
  });
  it("rejects failed tx, missing/foreign memo, wrong mint, outsiders, replays", () => {
    const M = mint.toBase58(), T = treasury.toBase58();
    expect(extractSettlements(g, "s", tx([tc(alice, 1), memo], { x: 1 }), M, T)).toMatchObject({ ok: false });
    expect(extractSettlements(g, "s", tx([tc(alice, 1)]), M, T)).toMatchObject({ ok: false, error: /memo/ });
    expect(extractSettlements(g, "s", tx([tc(alice, 1), { ...memo, parsed: "splitchai|g=other|n=1|legs=1" }]), M, T)).toMatchObject({ ok: false });
    const other = Keypair.generate().publicKey;
    expect(extractSettlements(g, "s", tx([tc(alice, 1, other), memo]), M, T)).toMatchObject({ ok: false, error: /mint/ });
    expect(extractSettlements(g, "s", tx([tc(bob, 1), memo]), M, T)).toMatchObject({ ok: false, error: /recipient/ });
    expect(extractSettlements(g, "s", tx([tc(alice, 1, mint, bob), memo]), M, T)).toMatchObject({ ok: false, error: /payer/ });
    const g2 = { ...g, settlements: [{ id: "1", from: "p", to: "a", amount: 1, fee: 0, signature: "dup", verifiedAt: 0 }] };
    expect(extractSettlements(g2, "dup", tx([tc(alice, 1), memo]), M, T)).toMatchObject({ ok: false, error: /already/ });
  });
});
