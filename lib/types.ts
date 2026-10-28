/**
 * Chai Pot domain model.
 * All money is stored as integer minor units (cents) in the pot's currency.
 */

export type Currency = "USD" | "EUR" | "GBP";
export const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"];

export const CATEGORIES = [
  "food",
  "groceries",
  "transport",
  "stay",
  "activities",
  "utilities",
  "shopping",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Member {
  id: string;
  name: string;
  email?: string;
  /** Optional Base wallet (lowercase 0x address) for USDC funding. */
  wallet?: string;
}

export interface Policy {
  /** Max a single bill the agent may pay without approval (minor units). */
  perBillCap: number;
  /** Max the agent may auto-pay per calendar day in the pot's timezone (minor units). */
  dailyCap: number;
  /** Categories the agent is allowed to pay for at all. */
  allowedCategories: Category[];
  /** Approvals needed (from members other than the requester) for anything above a cap. */
  approvalsRequired: number;
}

export type ContributionMethod = "paypal" | "usdc" | "seed";

export interface Contribution {
  id: string;
  memberId: string;
  amount: number;
  method: ContributionMethod;
  /** PayPal order id, if any. */
  orderId?: string;
  /** PayPal capture id (used for refunds) or Base tx hash. */
  ref: string;
  payerEmail?: string;
  createdAt: number;
  /** Seeded demo data, never a real payment. */
  sample?: boolean;
}

export interface Refund {
  id: string;
  contributionId: string;
  memberId: string;
  amount: number;
  /** PayPal refund id. */
  ref: string;
  status: string;
  createdAt: number;
  requestedBy: string;
}

export type SpendStatus = "pending_approval" | "rejected" | "paid" | "failed";

export interface ReceiptItem {
  name: string;
  quantity: number;
  total: number; // minor units, pot currency
}

export interface Spend {
  id: string;
  description: string;
  payeeEmail: string;
  payeeName?: string;
  category: Category;
  amount: number; // minor units, pot currency
  /** Original amount/currency if the request was in another currency. */
  original?: { amount: number; currency: string; rate: number };
  /** memberId -> share (minor units); sums to amount. */
  splits: Record<string, number>;
  status: SpendStatus;
  requestedBy: string;
  approvals: string[];
  rejectedBy?: string;
  createdAt: number;
  paidAt?: number;
  payout?: { batchId: string; status: string; itemStatus?: string; transactionId?: string };
  error?: string;
  items?: ReceiptItem[];
  sample?: boolean;
  /** Advisory review by Nemotron 3 Ultra for bills held for approval (Nebius build). */
  review?: { risk: "low" | "medium" | "high"; summary: string; questions: string[]; model: string };
}

export interface PolicyCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export type Decision = "auto_pay" | "needs_approval" | "reject";

export interface AuditEntry {
  id: string;
  at: number;
  /** "agent" or a member id. */
  actor: string;
  kind:
    | "pot_created"
    | "contribution"
    | "agent_receipt"
    | "agent_request"
    | "agent_needs_info"
    | "policy_decision"
    | "approval"
    | "rejection"
    | "payout"
    | "payout_failed"
    | "refund"
    | "risk_review"
    | "error";
  summary: string;
  /** Free-text model reasoning, shown verbatim. */
  reasoning?: string;
  decision?: Decision;
  checks?: PolicyCheck[];
  spendId?: string;
  data?: Record<string, unknown>;
  sample?: boolean;
}

export interface Pot {
  id: string;
  name: string;
  currency: Currency;
  timezone: string;
  createdAt: number;
  createdBy: string;
  members: Member[];
  /** Target contribution per member (minor units). */
  contributionTarget: number;
  policy: Policy;
  /** Optional Base address that receives USDC contributions. */
  usdcTreasury?: string;
  contributions: Contribution[];
  refunds: Refund[];
  spends: Spend[];
  audit: AuditEntry[];
  isDemo?: boolean;
}
