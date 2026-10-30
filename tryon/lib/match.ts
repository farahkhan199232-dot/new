import type { ConcernScore, Depth, Product, SkinProfile, Undertone } from "./types.ts";
import { CONCERN_LABEL } from "./catalog.ts";

/** sRGB hex -> CIE Lab (D65). */
export function hexToLab(hex: string): { L: number; a: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), bl = lin(n & 255);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * bl) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * bl;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * bl) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Hue angle in degrees (0-360) of a Lab colour. */
export function hueAngle(hex: string): number {
  const { a, b } = hexToLab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

/**
 * Undertone from the skin colour YouCam's Skin Tone Analysis returns.
 * Skin hues sit roughly between 40° (pinker, cool) and 70° (more golden, warm).
 */
export function undertoneOf(skinHex: string): Undertone {
  const h = hueAngle(skinHex);
  if (h >= 58) return "warm";
  if (h <= 48) return "cool";
  return "neutral";
}

export function depthOf(skinHex: string): Depth {
  const { L } = hexToLab(skinHex);
  if (L >= 70) return "light";
  if (L >= 48) return "medium";
  return "deep";
}

const clamp = (n: number, lo = 5, hi = 98) => Math.max(lo, Math.min(hi, Math.round(n)));

export interface Match {
  score: number;
  why: string;
}

/** Lip shade vs skin: enough contrast to show up, and a hue that agrees with the undertone. */
export function lipMatch(lipHex: string, p: Pick<SkinProfile, "skinHex" | "undertone" | "depth">): Match {
  const skin = hexToLab(p.skinHex);
  const lip = hexToLab(lipHex);
  const contrast = skin.L - lip.L; // positive = lipstick darker than skin
  const ideal = p.depth === "light" ? [12, 32] : p.depth === "medium" ? [16, 38] : [8, 30];
  let s = 55;
  const notes: string[] = [];
  if (contrast < 0) {
    s -= 30;
    notes.push("lighter than her skin, so it may look washed out");
  } else if (contrast < ideal[0]) {
    s -= 12;
    notes.push("a little low-contrast on her skin");
  } else if (contrast > ideal[1]) {
    s += 5;
    notes.push("bold and dramatic on her skin");
  } else {
    s += 22;
    notes.push("enough depth to show up without overpowering");
  }
  const h = hueAngle(lipHex);
  const lipWarm = h >= 25; // orange / brick / terracotta
  const lipCool = h <= 8 || h >= 340; // berry / blue-red / mauve
  if (p.undertone === "warm" && lipWarm) { s += 18; notes.push("warm shade suits her warm undertone"); }
  else if (p.undertone === "cool" && lipCool) { s += 18; notes.push("cool shade suits her cool undertone"); }
  else if (p.undertone === "neutral") { s += 10; notes.push("neutral undertone carries warm and cool shades"); }
  else if ((p.undertone === "warm" && lipCool) || (p.undertone === "cool" && lipWarm)) { s += 2; notes.push("hue runs against her undertone"); }
  else { s += 10; notes.push("in-between hue works with her undertone"); }
  return { score: clamp(s), why: cap(notes.join("; ")) };
}

export function earringMatch(metal: "gold" | "silver", undertone: Undertone): Match {
  if (undertone === "neutral") return { score: 84, why: `${up(metal)} works with her neutral undertone.` };
  const good = (metal === "gold" && undertone === "warm") || (metal === "silver" && undertone === "cool");
  return good
    ? { score: 92, why: `${up(metal)} flatters her ${undertone} undertone.` }
    : { score: 61, why: `${up(metal)} is usually less flattering on a ${undertone} undertone.` };
}

export function topMatch(family: "jewel" | "pastel", undertone: Undertone, depth: Depth): Match {
  if (family === "jewel") {
    if (depth !== "light" && undertone !== "cool") return { score: 91, why: `Jewel tones glow on ${depth}, ${undertone}-undertone skin.` };
    return { score: 74, why: "Jewel tones are striking but can overpower very light or cool skin." };
  }
  if (depth === "light" || undertone === "cool") return { score: 88, why: "Soft pastels suit light or cool-undertone skin." };
  return { score: 63, why: `Pale pastels can wash out ${depth}, ${undertone}-undertone skin.` };
}

/** Skincare: the lower the Skin AI score for the concern a product targets, the better the gift. */
export function skincareMatch(score: ConcernScore | undefined): Match {
  if (!score) return { score: 50, why: "No Skin AI reading for this concern yet." };
  const label = CONCERN_LABEL[score.type];
  if (score.ui >= 85) return { score: 35, why: `${label} already scores ${score.ui}/100, so she doesn't really need this.` };
  const s = clamp(40 + (85 - score.ui) * 2);
  return { score: s, why: `Skin AI scored ${label.toLowerCase()} ${score.ui}/100, so this targets a real concern.` };
}

export function matchProduct(prod: Product, profile: SkinProfile): Match {
  switch (prod.kind) {
    case "lip": return lipMatch(prod.hex!, profile);
    case "earring": return earringMatch(prod.metal!, profile.undertone);
    case "top": return topMatch(prod.colorFamily!, profile.undertone, profile.depth);
    case "skincare": return skincareMatch(profile.scores.find((s) => s.type === prod.concern));
  }
}

/** The concerns most worth gifting for, worst first (ui score below 80). */
export function topConcerns(profile: SkinProfile, n = 3): ConcernScore[] {
  return [...profile.scores].filter((s) => s.ui < 80).sort((a, b) => a.ui - b.ui).slice(0, n);
}

const up = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) + (s.endsWith(".") ? "" : ".") : s;
}
