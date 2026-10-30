import "server-only";
import type { ConcernScore, GiftPot, Proposal, SkinConcern, SkinProfile } from "./types.ts";
import { SKIN_CONCERNS } from "./types.ts";
import { KIND_API, product } from "./catalog.ts";
import { depthOf, matchProduct, topConcerns, undertoneOf } from "./match.ts";
import { addProposal, audit, member, newId } from "./pot.ts";
import { DEMO_FACE, DEMO_PHOTO, DEMO_TRYON, demoProfile } from "./seed.ts";
import { getPhoto, saveImage, takeLiveQuota } from "./store.ts";
import { clothesTryOn, earringTryOn, fetchResult, lipTryOn, skinAnalysis, skinTone, uploadImage, YouCamError } from "./youcam.ts";
import { CONCERN_LABEL } from "./catalog.ts";

async function quota(n: number) {
  const q = await takeLiveQuota(n);
  if (!q.ok) throw new YouCamError(`Today's live YouCam allowance for this public demo is used up (${q.cap} tasks). Cached real results still work; try live again tomorrow.`, "quota", 429);
}

async function photoBytes(pot: GiftPot, origin: string, closeUp = false): Promise<Uint8Array> {
  if (pot.demo) {
    // Skin AI wants the face to fill >60% of the frame, so the demo keeps a close-up crop of the same photo.
    const r = await fetch(new URL(closeUp ? DEMO_FACE : DEMO_PHOTO, origin), { cache: "no-store" });
    if (!r.ok) throw new Error("Demo photo missing");
    return new Uint8Array(await r.arrayBuffer());
  }
  const b64 = await getPhoto(pot.id);
  if (!b64) throw new Error("Add her photo first");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Run YouCam Skin Analysis + Skin Tone Analysis on the recipient photo and build her gift profile. */
export async function analyze(pot: GiftPot, origin: string, live: boolean): Promise<SkinProfile> {
  if (pot.demo && !live) {
    pot.profile = demoProfile();
    audit(pot, "skin", "Loaded the cached real Skin AI result for the demo photo");
    return pot.profile;
  }
  if (!pot.hasPhoto) throw new Error("Add her photo first");
  await quota(2);
  const bytes = await photoBytes(pot, origin, true);
  const fileId = await uploadImage(bytes, "image/jpeg", "recipient.jpg");
  const [scores, tone] = await Promise.all([skinAnalysis(fileId), skinTone(fileId)]);
  if (!tone?.skin_color) throw new YouCamError("Skin tone analysis returned no colour", "bad_response");
  const kept: ConcernScore[] = await Promise.all(
    scores
      .filter((s) => (SKIN_CONCERNS as readonly string[]).includes(s.type))
      .map(async (s) => {
        let mask: string | undefined;
        const url = s.mask_urls?.[0];
        if (url) {
          try {
            const img = await fetchResult(url);
            mask = await saveImage(`${pot.id}-mask-${s.type}-${newId(3)}`, img.contentType, img.bytes);
          } catch { /* the score still counts without its mask */ }
        }
        return { type: s.type as SkinConcern, ui: Math.round(s.ui_score!), raw: Math.round((s.raw_score ?? 0) * 10) / 10, mask };
      }),
  );
  const profile: SkinProfile = {
    source: "live",
    analyzedAt: Date.now(),
    scores: kept.sort((a, b) => a.ui - b.ui),
    skinHex: tone.skin_color.startsWith("#") ? tone.skin_color : `#${tone.skin_color}`,
    lipHex: tone.lip_color,
    eyeColor: tone.eye_color_name,
    hairColor: tone.hair_color_name,
    undertone: undertoneOf(tone.skin_color),
    depth: depthOf(tone.skin_color),
  };
  pot.profile = profile;
  // Proposals scored against an older profile get re-scored.
  for (const p of pot.proposals) Object.assign(p, (({ score, why }) => ({ match: score, why }))(matchProduct(product(p.productId), profile)));
  const worst = topConcerns(profile).map((c) => CONCERN_LABEL[c.type].toLowerCase());
  audit(pot, "skin", `Skin AI (live): ${profile.undertone} undertone, ${profile.depth} depth${worst.length ? `; lowest scores: ${worst.join(", ")}` : ""}`);
  return profile;
}

/** Render a product on her photo with the matching YouCam try-on API and add it as a proposal. */
export async function tryOn(pot: GiftPot, memberId: string, productId: string, origin: string, live: boolean): Promise<Proposal> {
  member(pot, memberId);
  const prod = product(productId);
  if (!pot.profile) throw new Error("Run Skin AI on her photo first, so every gift gets a match score");
  const mt = matchProduct(prod, pot.profile);
  const base = { productId, memberId, match: mt.score, why: mt.why };

  if (prod.kind === "skincare") {
    const mask = pot.profile.scores.find((s) => s.type === prod.concern)?.mask;
    return addProposal(pot, { ...base, image: mask, source: pot.profile.source, api: KIND_API.skincare });
  }
  if (pot.demo && !live) {
    return addProposal(pot, { ...base, image: DEMO_TRYON[productId], source: "cached", api: KIND_API[prod.kind] });
  }
  await quota(1);
  const src = await uploadImage(await photoBytes(pot, origin), "image/jpeg", "recipient.jpg");
  let url: string;
  if (prod.kind === "lip") {
    url = await lipTryOn(src, prod.hex!, prod.lipTexture || "satin");
  } else {
    const r = await fetch(new URL(prod.image!, origin), { cache: "no-store" });
    if (!r.ok) throw new Error(`Catalog image missing for ${prod.name}`);
    const ref = await uploadImage(new Uint8Array(await r.arrayBuffer()), "image/jpeg", `${prod.id}.jpg`);
    url = prod.kind === "earring" ? await earringTryOn(src, ref) : await clothesTryOn(src, ref);
  }
  const img = await fetchResult(url);
  const image = await saveImage(`${pot.id}-${prod.id}-${newId(4)}`, img.contentType, img.bytes);
  return addProposal(pot, { ...base, image, source: "live", api: KIND_API[prod.kind] });
}
