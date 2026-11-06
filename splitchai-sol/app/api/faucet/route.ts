import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createMintToCheckedInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { connection } from "@/lib/chain";
import { MINT, RPC_URL } from "@/lib/config";
import { bad, ok } from "@/lib/http";
import { takeOnce } from "@/lib/store";

export const maxDuration = 30;
const DRIP = 100_000_000; // 100 tUSDC
const SOL_TOPUP = 0.01 * LAMPORTS_PER_SOL;

function authority(): Keypair | null {
  const raw = process.env.MINT_AUTHORITY_SECRET;
  if (!raw) return null;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

/** Devnet-only test-token faucet: mints 100 tUSDC (and a pinch of devnet SOL for fees). */
export async function POST(req: Request) {
  if (/mainnet/i.test(process.env.SOLANA_RPC_URL || RPC_URL)) return bad("faucet is devnet only", 403);
  const kp = authority();
  if (!kp) return bad("faucet not configured", 503);
  const body = await req.json().catch(() => ({}));
  let owner: PublicKey;
  try {
    owner = new PublicKey(String(body.wallet));
  } catch {
    return bad("invalid Solana address");
  }
  if (!(await takeOnce(`faucet:${owner.toBase58()}`, 600))) return bad("already sent recently, try again in 10 minutes", 429);
  const mint = new PublicKey(MINT);
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, ata, owner, mint),
    createMintToCheckedInstruction(mint, ata, kp.publicKey, DRIP, 6),
  );
  const bal = await connection.getBalance(owner);
  const sol = bal < 0.005 * LAMPORTS_PER_SOL;
  if (sol) tx.add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: owner, lamports: SOL_TOPUP }));
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = kp.publicKey;
    tx.sign(kp);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return ok({ signature: sig, amount: DRIP, sol: sol ? 0.01 : 0 });
  } catch (e) {
    return bad("faucet transaction failed: " + (e as Error).message.slice(0, 160), 502);
  }
}
