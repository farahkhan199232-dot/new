/**
 * End-to-end devnet check against a running app (BASE env, default http://localhost:3000):
 * creates a group, links two sandbox test wallets, adds expenses, settles with ONE tx
 * built by lib/tx.ts, and asks the server to verify it from devnet.
 * Usage: BASE=https://... KEYS=/path/to/keys npx tsx scripts/e2e.ts   (devnet only)
 */
import fs from "node:fs";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import { buildSettleTx } from "../lib/tx";
import { MINT, TREASURY } from "../lib/config";

const BASE = process.env.BASE || "http://localhost:3000";
const KEYS = process.env.KEYS!;
const L = (n: string) => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(`${KEYS}/${n}.json`, "utf8"))));
const api = async (path: string, body?: unknown) => {
  const r = await fetch(BASE + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(j)}`);
  return j;
};

const alice = L("alice"), bob = L("bob"), cara = L("cara");
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const { id, memberId } = await api("/api/groups", { name: "E2E chai run", yourName: "Alice", members: ["Bob", "Cara"] });
let g = await api(`/api/groups/${id}`);
const [A, B, C] = g.members;
await api(`/api/groups/${id}/members`, { memberId: A.id, wallet: alice.publicKey.toBase58() });
await api(`/api/groups/${id}/members`, { memberId: B.id, wallet: bob.publicKey.toBase58() });
g = await api(`/api/groups/${id}/members`, { memberId: C.id, wallet: cara.publicKey.toBase58() });
await api(`/api/groups/${id}/expenses`, { description: "Chai and samosas", amount: "9.00", paidBy: B.id, mode: "equal" });
g = await api(`/api/groups/${id}/expenses`, { description: "Cab", amount: "4.50", paidBy: C.id, mode: "custom", shares: { [A.id]: "1.50", [C.id]: "1.50", [B.id]: "1.50" } });
console.log("group", id, "member", memberId);
// Alice owes Bob 3.00 (chai) and Cara 1.50 (cab): pay BOTH in one atomic tx with fee + memo.
const { blockhash } = await conn.getLatestBlockhash("confirmed");
const tx = buildSettleTx({ payer: alice.publicKey, mint: new PublicKey(MINT), decimals: 6, feeBps: g.feeBps, treasury: new PublicKey(TREASURY),
  groupId: id, nonce: "e2e" + Date.now().toString(36), legs: [{ creditor: bob.publicKey, amount: 3_000_000 }, { creditor: cara.publicKey, amount: 1_500_000 }] }, blockhash);
const t0 = Date.now();
const sig = await sendAndConfirmTransaction(conn, tx, [alice], { commitment: "confirmed" });
console.log("settle sig", sig, "confirmed in", Date.now() - t0, "ms");
const res = await api(`/api/groups/${id}/settle`, { signature: sig });
console.log("verified", res.recorded, "settlement(s); fee", res.fee, "slot", res.slot, "network fee lamports", res.networkFeeLamports);
// replay must be rejected
const r2 = await fetch(`${BASE}/api/groups/${id}/settle`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature: sig }) });
console.log("replay status", r2.status);
console.log(JSON.stringify({ group: id, signature: sig }));
