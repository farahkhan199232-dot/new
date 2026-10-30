import type { Product, SkinConcern } from "./types.ts";

/**
 * Demo catalog. Products and brands are fictional ("Chai Pot Studio"); product photos
 * were generated for this project, so there are no third-party trademarks.
 */
export const CATALOG: Product[] = [
  { id: "lip-chai-rose", kind: "lip", brand: "Chai Pot Studio", name: "Chai Rose lipstick", price: 89900, hex: "#B5485D", lipTexture: "satin", blurb: "Rosy mauve satin, the everyday crowd-pleaser." },
  { id: "lip-brick-masala", kind: "lip", brand: "Chai Pot Studio", name: "Brick Masala lipstick", price: 79900, hex: "#8E3B2F", lipTexture: "matte", blurb: "Warm terracotta matte with a spicy edge." },
  { id: "lip-berry-mehfil", kind: "lip", brand: "Chai Pot Studio", name: "Berry Mehfil lipstick", price: 94900, hex: "#7B2944", lipTexture: "matte", blurb: "Deep berry for evenings and weddings." },
  { id: "lip-peach-lassi", kind: "lip", brand: "Chai Pot Studio", name: "Peach Lassi gloss", price: 69900, hex: "#F0A493", lipTexture: "gloss", blurb: "Pale peach gloss, very light." },
  { id: "ear-gold-jhumka", kind: "earring", brand: "Chai Pot Studio", name: "Gold pearl jhumkas", price: 249900, image: "/catalog/earring_jhumka.jpg", metal: "gold", blurb: "Gold-tone jhumkas with pearl drops." },
  { id: "ear-silver-hoop", kind: "earring", brand: "Chai Pot Studio", name: "Silver crystal hoops", price: 189900, image: "/catalog/earring_hoop.jpg", metal: "silver", blurb: "Minimal silver hoops with a crystal teardrop." },
  { id: "top-emerald-kurta", kind: "top", brand: "Chai Pot Studio", name: "Emerald silk kurta", price: 329900, image: "/catalog/kurta_emerald.jpg", colorFamily: "jewel", blurb: "Emerald silk with gold neckline embroidery." },
  { id: "top-blush-blouse", kind: "top", brand: "Chai Pot Studio", name: "Blush linen blouse", price: 219900, image: "/catalog/blouse_blush.jpg", colorFamily: "pastel", blurb: "Soft pink linen with puff sleeves." },
  { id: "care-hydra-serum", kind: "skincare", brand: "Chai Pot Studio", name: "Hyaluronic hydra serum", price: 129900, concern: "moisture", blurb: "Hyaluronic acid + ceramides for dehydrated skin." },
  { id: "care-eye-cream", kind: "skincare", brand: "Chai Pot Studio", name: "Caffeine bright-eye cream", price: 99900, concern: "dark_circle_v2", blurb: "Caffeine + vitamin K for under-eye shadows." },
  { id: "care-niacinamide", kind: "skincare", brand: "Chai Pot Studio", name: "Niacinamide pore gel", price: 84900, concern: "pore", blurb: "10% niacinamide for visible pores and shine." },
  { id: "care-vitc", kind: "skincare", brand: "Chai Pot Studio", name: "Vitamin C glow drops", price: 119900, concern: "radiance", blurb: "15% vitamin C for dull, uneven tone." },
];

export function product(id: string): Product {
  const p = CATALOG.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown product: ${id}`);
  return p;
}

export const CONCERN_LABEL: Record<SkinConcern, string> = {
  moisture: "Hydration",
  oiliness: "Oil control",
  pore: "Pores",
  texture: "Texture",
  acne: "Clear skin",
  redness: "Calm (redness)",
  dark_circle_v2: "Under-eyes",
  radiance: "Radiance",
};

/** Which YouCam API renders a product kind. */
export const KIND_API: Record<Product["kind"], string> = {
  lip: "AI Makeup Virtual Try-On (lip_color)",
  earring: "AI Earrings Virtual Try-On",
  top: "AI Clothes Virtual Try-On",
  skincare: "AI Skin Analysis (detection mask)",
};
