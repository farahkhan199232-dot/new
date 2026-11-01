/** yoctoNEAR <-> NEAR helpers (pure; 1 NEAR = 10^24 yocto). */
const DEC = 24;
const ONE = 10n ** 24n;

export function toYocto(near: string | number): string {
  const s = String(near).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`Invalid NEAR amount: ${near}`);
  const [whole, frac = ""] = s.split(".");
  if (frac.length > DEC) throw new Error("Too many decimals");
  return (BigInt(whole) * ONE + BigInt(frac.padEnd(DEC, "0") || "0")).toString();
}

/** Formats yocto as NEAR with up to `digits` decimals, trailing zeros trimmed. */
export function fromYocto(yocto: string | bigint, digits = 4): string {
  const v = BigInt(yocto);
  const neg = v < 0n;
  const a = neg ? -v : v;
  const whole = a / ONE;
  const frac = (a % ONE).toString().padStart(DEC, "0").slice(0, digits).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export const nearLabel = (yocto: string | bigint, digits = 4) => `${fromYocto(yocto, digits)} NEAR`;

/** NEAR account id rules (named or 64-hex implicit). */
export function isAccountId(s: string): boolean {
  return s.length >= 2 && s.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(s);
}
