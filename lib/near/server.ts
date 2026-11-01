import { Account, KeyPairSigner } from "near-api-js";
import { DEMO_MEMBERS, DEMO_PAYEE, NEAR_AGENT, NEAR_CONTRACT, NEAR_RPC } from "./config";

/**
 * Server-side NEAR signers.
 * - The agent signs ONLY with a function-call access key that the chain restricts to
 *   `agent_review` on the pot contract (allowance 0.5 NEAR for gas). It cannot transfer NEAR,
 *   call any other method, or touch any other contract.
 * - Demo members are testnet sub-accounts created for the public demo pot. Real users sign with
 *   their own NEAR wallet in the browser; their keys never reach this server.
 */
const GAS = 100_000_000_000_000n; // 100 Tgas

export const agentConfigured = () => !!process.env.NEAR_AGENT_KEY;

function agentAccount() {
  const key = process.env.NEAR_AGENT_KEY;
  if (!key) throw new Error("Agent not configured: set NEAR_AGENT_KEY (function-call key for agent_review)");
  return new Account(NEAR_AGENT, NEAR_RPC, KeyPairSigner.fromSecretKey(key as `ed25519:${string}`));
}

function demoKeys(): Record<string, string> {
  try {
    return JSON.parse(process.env.NEAR_DEMO_KEYS || "{}");
  } catch {
    return {};
  }
}

export const demoConfigured = () => DEMO_MEMBERS.every((m) => !!demoKeys()[m]);

export function demoAccount(id: string) {
  if (![...DEMO_MEMBERS, DEMO_PAYEE].includes(id)) throw new Error("Not a demo account");
  const key = demoKeys()[id];
  if (!key) throw new Error("Demo keys not configured");
  return new Account(id, NEAR_RPC, KeyPairSigner.fromSecretKey(key as `ed25519:${string}`));
}

export interface TxResult {
  hash: string;
  value: unknown;
  failure?: string;
}

function unpack(res: unknown): TxResult {
  const r = res as { transaction?: { hash: string }; transaction_outcome?: { id: string }; status?: { SuccessValue?: string; Failure?: unknown } };
  const hash = r.transaction?.hash || r.transaction_outcome?.id || "";
  let value: unknown;
  if (typeof r.status?.SuccessValue === "string" && r.status.SuccessValue) {
    try {
      value = JSON.parse(Buffer.from(r.status.SuccessValue, "base64").toString());
    } catch {
      value = undefined;
    }
  }
  const failure = r.status?.Failure ? JSON.stringify(r.status.Failure) : undefined;
  return { hash, value, failure };
}

export async function callAs(account: Account, methodName: string, args: object, deposit = 0n): Promise<TxResult> {
  const res = await account.callFunctionRaw({ contractId: NEAR_CONTRACT, methodName, args, deposit, gas: GAS, waitUntil: "EXECUTED_OPTIMISTIC" } as never);
  const out = unpack(res);
  if (out.failure) throw new Error(`Transaction failed: ${humanFailure(out.failure)} (tx ${out.hash})`);
  return out;
}

export async function agentReview(potId: number, spendId: number, approve: boolean, reason: string, verdictHash: string) {
  return callAs(agentAccount(), "agent_review", { pot_id: potId, spend_id: spendId, approve, reason, verdict_hash: verdictHash });
}

export async function transferAs(account: Account, receiverId: string, amount: bigint) {
  const res = await account.transfer({ receiverId, amount } as never);
  return unpack(res);
}

function humanFailure(f: string): string {
  const m = f.match(/Smart contract panicked: ([^"\\]+)/);
  return m ? m[1] : f.slice(0, 200);
}
