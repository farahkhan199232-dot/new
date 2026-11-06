export type Micro = number; // USDC base units (6 decimals), always an integer

export interface Member {
  id: string;
  name: string;
  wallet?: string; // base58 Solana address, set once by the member
}

export interface Expense {
  id: string;
  description: string;
  amount: Micro;
  paidBy: string; // member id
  shares: Record<string, Micro>; // member id -> owed amount; sums to amount
  splitMode: "equal" | "custom";
  createdAt: number;
}

export interface Settlement {
  id: string;
  from: string; // member id (debtor)
  to: string; // member id (creditor)
  amount: Micro;
  fee: Micro;
  signature: string;
  slot?: number;
  blockTime?: number | null;
  verifiedAt: number;
}

export interface Group {
  id: string;
  name: string;
  createdAt: number;
  feeBps: number; // 0 or 30
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
}

export interface Transfer {
  from: string;
  to: string;
  amount: Micro;
}
