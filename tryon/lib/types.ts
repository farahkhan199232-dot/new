/**
 * Chai Pot Try-On domain model.
 * Money is integer minor units (paise for INR).
 */

export type Currency = "INR";

export type ProductKind = "lip" | "earring" | "top" | "skincare";

export type Undertone = "warm" | "cool" | "neutral";
export type Depth = "light" | "medium" | "deep";

export interface Product {
  id: string;
  kind: ProductKind;
  name: string;
  brand: string;
  price: number; // minor units
  blurb: string;
  /** Lip shade hex (lip products). */
  hex?: string;
  lipTexture?: "matte" | "satin" | "gloss";
  /** Catalog image path under /public (earrings, tops). */
  image?: string;
  /** Earrings: metal, used for undertone matching. */
  metal?: "gold" | "silver";
  /** Tops: dominant colour family, used for undertone/depth matching. */
  colorFamily?: "jewel" | "pastel";
  /** Skincare: the Skin AI concern it targets. */
  concern?: SkinConcern;
}

export const SKIN_CONCERNS = [
  "moisture",
  "oiliness",
  "pore",
  "texture",
  "acne",
  "redness",
  "dark_circle_v2",
  "radiance",
] as const;
export type SkinConcern = (typeof SKIN_CONCERNS)[number];

export interface ConcernScore {
  type: SkinConcern;
  /** YouCam ui_score, 1-100, higher = healthier. */
  ui: number;
  raw: number;
  /** Detection mask image (our own /api/img/... or /demo/... URL), if kept. */
  mask?: string;
}

export interface SkinProfile {
  scores: ConcernScore[];
  /** From YouCam Skin Tone Analysis. */
  skinHex: string;
  lipHex?: string;
  eyeColor?: string;
  hairColor?: string;
  undertone: Undertone;
  depth: Depth;
  analyzedAt: number;
  /** "live" = ran against the YouCam API for this pot; "cached" = stored real output (demo). */
  source: "live" | "cached";
}

export interface Member {
  id: string;
  name: string;
}

export interface Proposal {
  id: string;
  productId: string;
  memberId: string;
  /** Try-on result image URL (/api/img/.. or /demo/..). Skincare proposals reuse a skin mask. */
  image?: string;
  match: number; // 0-100
  why: string;
  createdAt: number;
  source: "live" | "cached";
  /** Which YouCam API produced the image. */
  api?: string;
}

export interface Contribution {
  id: string;
  memberId: string;
  amount: number;
  createdAt: number;
  /** Always "demo": no real money moves in this build. */
  method: "demo";
}

export interface AuditEntry {
  id: string;
  at: number;
  kind: string;
  text: string;
}

export interface GiftPot {
  id: string;
  title: string;
  recipient: string;
  occasion: string;
  currency: Currency;
  /** Max price per gift the group agreed on (minor units). */
  budget: number;
  members: Member[];
  hasPhoto: boolean;
  profile?: SkinProfile;
  proposals: Proposal[];
  /** memberId -> proposalId */
  votes: Record<string, string>;
  /** Proposal locked in when the vote is closed. */
  lockedProposalId?: string;
  contributions: Contribution[];
  order?: { id: string; placedAt: number; amount: number; productId: string };
  audit: AuditEntry[];
  demo?: boolean;
  createdAt: number;
}
