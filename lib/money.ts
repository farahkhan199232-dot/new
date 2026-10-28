/** Money helpers. Amounts are integer minor units (2-decimal currencies only). */

/** "2,400.50" or 2400.5 -> 240050. Throws on negatives, NaN or more than 2 decimals. */
export function toMinor(input: string | number): number {
  const s = String(input).replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${input}`);
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Major-unit float (e.g. from an AI model) -> minor units, rounded to the nearest cent. */
export function majorToMinor(n: number): number {
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${n}`);
  return Math.round(n * 100);
}

/** 240050 -> "2400.50" (the string format PayPal's REST APIs expect). */
export function toDecimalString(minor: number): string {
  if (!Number.isInteger(minor) || minor < 0) throw new Error(`Invalid minor amount: ${minor}`);
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

/** Equal split; leftover cents go to the first members so shares always sum to the total. */
export function splitEqual(total: number, memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0) throw new Error("No members to split between");
  const n = memberIds.length;
  const base = Math.floor(total / n);
  let rem = total - base * n;
  const out: Record<string, number> = {};
  for (const id of memberIds) {
    out[id] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  return out;
}

/**
 * Indicative FX rates to USD, used only when someone asks the agent to pay a bill
 * in a currency other than the pot's. The rate used is written to the audit log.
 * PayPal converts the actual payout; these are not live market rates.
 */
export const INDICATIVE_USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  INR: 0.012,
  AED: 0.272,
  SGD: 0.74,
};

export function convertMinor(minor: number, from: string, to: string): { amount: number; rate: number } {
  const f = INDICATIVE_USD_RATES[from.toUpperCase()];
  const t = INDICATIVE_USD_RATES[to.toUpperCase()];
  if (!f || !t) throw new Error(`No rate for ${from} -> ${to}`);
  const rate = f / t;
  return { amount: Math.round(minor * rate), rate };
}
