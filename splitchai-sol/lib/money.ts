import type { Micro } from "./types";

export const DECIMALS = 6;
const UNIT = 10 ** DECIMALS;

/** Parse a user-entered dollar string ("12.5", "$1,200.00") into integer micro-units. */
export function parseUsdc(input: string): Micro | null {
  const s = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,6})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const v = Number(whole) * UNIT + Number((frac + "000000").slice(0, 6));
  if (!Number.isSafeInteger(v)) return null;
  return v;
}

/** Format micro-units as a dollar string with 2 decimals (more if needed). */
export function formatUsdc(v: Micro, opts: { sign?: boolean } = {}): string {
  const neg = v < 0;
  const abs = Math.abs(v);
  const whole = Math.floor(abs / UNIT);
  const frac = abs % UNIT;
  let fs = String(frac).padStart(6, "0").replace(/0+$/, "");
  if (fs.length < 2) fs = fs.padEnd(2, "0");
  const body = `$${whole.toLocaleString("en-US")}.${fs}`;
  if (neg) return `-${body}`;
  return opts.sign && v > 0 ? `+${body}` : body;
}

/** Protocol fee, rounded down so the payer is never over-charged. */
export function feeFor(amount: Micro, feeBps: number): Micro {
  if (feeBps <= 0) return 0;
  return Math.floor((amount * feeBps) / 10_000);
}
