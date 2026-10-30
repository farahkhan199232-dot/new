/** Money helpers (carried over from Chai Pot). Amounts are integer minor units. */

export function toMinor(input: string | number): number {
  const s = String(input).replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid amount: ${input}`);
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatMoney(minor: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

/** Equal split; leftover paise go to the first members so shares always sum to the total. */
export function splitEqual(total: number, memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0) throw new Error("No members to split between");
  if (!Number.isInteger(total) || total < 0) throw new Error(`Invalid total: ${total}`);
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
