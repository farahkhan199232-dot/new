/** JSON shapes returned by the chai-pot-near contract (U128/U64 are strings). */
export type SpendStatus = "PendingAgent" | "NeedsVotes" | "Paid" | "Rejected" | "Failed";

export interface NearSpend {
  id: number;
  requester: string;
  to: string;
  amount: string;
  category: string;
  memo: string;
  status: SpendStatus;
  reason: string;
  verdict_hash: string;
  approvals: string[];
  created_at: string;
  decided_at: string;
}

export interface NearContribution {
  account: string;
  deposited: string;
  withdrawn: string;
}

export interface NearPot {
  id: number;
  name: string;
  creator: string;
  members: string[];
  agent: string;
  per_spend_cap: string;
  daily_cap: string;
  approvals_needed: number;
  categories: string[];
  balance: string;
  spent_total: string;
  spent_today: string;
  day: string;
  contributions: NearContribution[];
  spend_count: number;
  created_at: string;
}

/** What the AI agent decided about one spend, kept off-chain; its sha256 is stored on-chain. */
export interface AgentVerdict {
  approve: boolean;
  risk: "low" | "medium" | "high";
  reason: string;
  flags: string[];
}

export interface IntentsQuote {
  /** USDC (on Base) the payee would receive if this spend were settled cross-chain via NEAR Intents 1Click. */
  usdcOut: string;
  usdIn: string;
  timeEstimateSec: number;
  dry: true;
  error?: string;
}

export interface VerdictLog {
  potId: number;
  spendId: number;
  verdict: AgentVerdict;
  verdictJson: string;
  verdictHash: string;
  model: string;
  quote: IntentsQuote | null;
  payee: { exists: boolean; isContract: boolean; balance?: string };
  txHash?: string;
  outcome?: SpendStatus;
  error?: string;
  at: number;
}
