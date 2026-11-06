import "server-only";
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "./config";
import type { ParsedTxLite } from "./verify";

const SERVER_RPC = process.env.SOLANA_RPC_URL || RPC_URL;
export const connection = new Connection(SERVER_RPC, "confirmed");

/** Fetch a transaction from devnet (retries briefly while it propagates). */
export async function fetchParsedTx(sig: string): Promise<ParsedTxLite | null> {
  for (let i = 0; i < 8; i++) {
    const tx = await connection.getParsedTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (tx) {
      return {
        slot: tx.slot,
        blockTime: tx.blockTime,
        err: tx.meta?.err ?? null,
        fee: tx.meta?.fee,
        instructions: tx.transaction.message.instructions.map((ix: any) => ({
          program: ix.program,
          programId: ix.programId?.toBase58?.(),
          parsed: ix.parsed,
        })),
      };
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}
