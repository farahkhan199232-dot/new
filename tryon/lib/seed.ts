import type { GiftPot, SkinProfile } from "./types.ts";
import { product } from "./catalog.ts";
import { matchProduct } from "./match.ts";

export const DEMO_POT_ID = "demo";

/**
 * Real YouCam API outputs for the demo photo (an AI-generated, fictional person), captured on
 * 31 Oct 2026 and stored under /public/demo so judges can click through without spending units.
 * Skin AI: skin-analysis (SD, 8 concerns) + skin-tone-analysis. Try-ons: makeup-vto, 2d-vto/earring, cloth.
 */
export const DEMO_PHOTO = "/demo/aisha.jpg";
export const DEMO_FACE = "/demo/aisha_face.jpg";

export const DEMO_TRYON: Record<string, string> = {
  "lip-chai-rose": "/demo/tryon_lip-chai-rose.jpg",
  "lip-brick-masala": "/demo/tryon_lip-brick-masala.jpg",
  "lip-berry-mehfil": "/demo/tryon_lip-berry-mehfil.jpg",
  "lip-peach-lassi": "/demo/tryon_lip-peach-lassi.jpg",
  "ear-gold-jhumka": "/demo/tryon_ear-gold-jhumka.jpg",
  "ear-silver-hoop": "/demo/tryon_ear-silver-hoop.jpg",
  "top-emerald-kurta": "/demo/tryon_top-emerald-kurta.jpg",
  "top-blush-blouse": "/demo/tryon_top-blush-blouse.jpg",
};

export function demoProfile(): SkinProfile {
  const m = (t: string) => `/demo/mask_${t}.jpg`;
  return {
    source: "cached",
    analyzedAt: Date.UTC(2026, 9, 30, 22, 44),
    skinHex: "#9e795f",
    lipHex: "#b27c78",
    eyeColor: "Brown",
    hairColor: "Auburn",
    undertone: "warm",
    depth: "medium",
    scores: [
      { type: "dark_circle_v2", ui: 62, raw: 41.7, mask: m("dark_circle_v2") },
      { type: "moisture", ui: 69, raw: 46.9, mask: m("moisture") },
      { type: "oiliness", ui: 69, raw: 54.5, mask: m("oiliness") },
      { type: "pore", ui: 72, raw: 59.2, mask: m("pore") },
      { type: "radiance", ui: 78, raw: 74.9, mask: m("radiance") },
      { type: "texture", ui: 82, raw: 83.8, mask: m("texture") },
      { type: "acne", ui: 83, raw: 85.6, mask: m("acne") },
      { type: "redness", ui: 99, raw: 100, mask: m("redness") },
    ],
  };
}

export function demoPot(): GiftPot {
  const now = Date.now();
  const profile = demoProfile();
  const pot: GiftPot = {
    id: DEMO_POT_ID,
    title: "Aisha turns 30",
    recipient: "Aisha",
    occasion: "30th birthday",
    currency: "INR",
    budget: 350000,
    members: [
      { id: "riya", name: "Riya" },
      { id: "kabir", name: "Kabir" },
      { id: "meera", name: "Meera" },
      { id: "dev", name: "Dev" },
    ],
    hasPhoto: true,
    profile,
    proposals: [],
    votes: {},
    contributions: [],
    audit: [],
    demo: true,
    createdAt: now,
  };
  const seed = (id: string, productId: string, memberId: string, ago: number) => {
    const mt = matchProduct(product(productId), profile);
    pot.proposals.push({ id, productId, memberId, image: DEMO_TRYON[productId], match: mt.score, why: mt.why, createdAt: now - ago, source: "cached", api: "cached" });
    pot.votes[memberId] = id;
  };
  seed("p-jhumka", "ear-gold-jhumka", "kabir", 60_000);
  seed("p-brick", "lip-brick-masala", "riya", 120_000);
  pot.audit.push(
    { id: "a3", at: now - 60_000, kind: "propose", text: "Kabir proposed Gold pearl jhumkas" },
    { id: "a2", at: now - 120_000, kind: "propose", text: "Riya proposed Brick Masala lipstick" },
    { id: "a1", at: now - 180_000, kind: "skin", text: "Skin AI ran on Aisha's selfie: warm undertone, medium depth; under-eyes and hydration are her lowest scores" },
  );
  return pot;
}
