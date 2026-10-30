# Chai Pot Try-On 💄☕

**Group gifts that actually suit her.** Friends pool money for a beauty or fashion gift. YouCam **Skin AI** reads her skin and skin tone from one selfie, YouCam **virtual try-on** shows every gift idea on her own photo, the group votes with a skin-aware match score, and the pot splits and pays for the winner.

Built for the **YouCam API Skin AI & eCommerce VTO Hackathon** (Devpost, 2026) as a new feature set on top of [Chai Pot](https://github.com/farahkhan199232-dot/new) (a group wallet I built earlier).

- **Live demo:** https://chai-pot-tryon.vercel.app (demo pot: https://chai-pot-tryon.vercel.app/g/demo)
- **Code:** this folder (`tryon/` on the `youcam-vto` branch). MIT licensed.

## The problem

Group gifts for beauty and fashion are guesswork. Four friends in a group chat guess her shade, argue about gold vs silver, and buy skincare for a problem she doesn't have. When four people paid, nobody wants to deal with the return. The people buying never see the product on her, and never see her skin data.

## What it does

1. **Skin AI reads her (YouCam AI Skin Analysis + AI Facial Color Tones Analyzer).** One selfie. Skin Analysis (SD) scores 8 concerns: hydration, oil, pores, texture, acne, redness, under-eyes, radiance, with a detection mask for each. Skin Tone Analysis returns her skin colour (plus lip, eye and hair colour). We convert the skin colour to CIE Lab and derive **undertone** (warm / neutral / cool, from the Lab hue angle) and **depth** (light / medium / deep, from L\*).
2. **Try gifts on her (YouCam AI Makeup VTO, AI Earrings VTO, AI Clothes VTO).** The shelf mixes beauty and fashion in one flow:
   - lipsticks → `makeup-vto` with a `lip_color` effect (shade hex + matte/satin/gloss texture)
   - jhumkas and hoops → `2d-vto/earring` with the product photo (background removal on)
   - kurtas and blouses → `cloth` with the garment photo (`upper_body`)
   - skincare → matched to her Skin AI scores; the proposal shows the YouCam detection mask for the concern it treats
3. **Skin-aware match score.** Every product gets a 0–100 score with a plain-English reason (`lib/match.ts`, unit-tested):
   - lip shades: Lab lightness contrast against her skin (too pale "washes out", too close is "low-contrast") plus hue agreement with her undertone
   - metals: gold for warm, silver for cool, both for neutral
   - outfits: jewel tones for medium/deep warm skin, pastels for light or cool
   - skincare: the lower her Skin AI score for the targeted concern, the higher the match ("Skin AI scored under-eyes 62/100, so this targets a real concern")
4. **Vote.** Each friend proposes from the shelf (proposing counts as their vote) and can switch votes until the vote closes. Most votes wins; ties go to the better match.
5. **Pool and buy (Chai Pot logic).** Closing the vote locks the winner and splits its price equally to the paisa. Each friend chips in their share; when the pot is fully funded the order is placed. *Payments are demo-only in this build; no money moves.*

## YouCam APIs used

| Feature | Endpoint | Where |
| --- | --- | --- |
| AI Skin Analysis (SD, 8 concerns, masks) | `POST /s2s/v2.0/task/skin-analysis` | `lib/youcam.ts` `skinAnalysis()` |
| AI Facial Color Tones Analyzer | `POST /s2s/v2.0/task/skin-tone-analysis` | `skinTone()` |
| AI Makeup Virtual Try-On (lip_color) | `POST /s2s/v2.0/task/makeup-vto` | `lipTryOn()` |
| AI Earrings Virtual Try-On | `POST /s2s/v2.0/task/2d-vto/earring` | `earringTryOn()` |
| AI Clothes Virtual Try-On | `POST /s2s/v2.0/task/cloth` | `clothesTryOn()` |
| File API | `POST /s2s/v2.0/file` + presigned PUT | `uploadImage()` |
| Unit balance (health check) | `GET /s2s/v1.0/client/credit` | `/api/health` |

All calls are server-side (the key never reaches the browser). Each task is started, then polled until `success`/`error`; YouCam error codes such as `error_src_face_too_small` are turned into friendly messages. YouCam result URLs expire after about 2 hours, so every result image is copied into Redis and served from `/api/img/:id`.

## Demo mode (so judges don't burn units)

The demo pot (`/g/demo`) loads **real YouCam outputs captured for the demo photo** (stored in `public/demo/`), so everything is instant. Tick **"Call the YouCam API live"** or press **"Re-run Skin AI live"** to make a fresh real call. Pots you create always call the API live. A daily cap (`LIVE_TASKS_PER_DAY`, default 40) protects the free units. `GET /api/health` reads the unit balance to show the key works without spending anything.

The demo face is AI-generated (a fictional person) and every product and brand is fictional with generated product photos, so there are no third-party trademarks.

## Run it

```bash
npm install
cp .env.example .env.local   # add YOUCAM_API_KEY (and Upstash Redis vars for persistence)
npm test                      # 15 unit tests (match scoring, pot rules, money)
npm run typecheck
npm run dev                   # http://localhost:3000, then open /g/demo
```

Env vars: `YOUCAM_API_KEY` (from the YouCam API console; India region: https://yce.makeupar.com/api-console/en/api-keys/), optional `YOUCAM_API_BASE` (default `https://yce-api-01.makeupar.com`), `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Upstash Redis; without them data lives in memory), `STORE_PREFIX`, `LIVE_TASKS_PER_DAY`.

## Stack

Next.js 16 (App Router) on Vercel · TypeScript · Upstash Redis · YouCam API. No UI framework; plain CSS.

## What's new vs. Chai Pot

Chai Pot (October 2026) is a group wallet where an AI agent pays bills within limits. Everything YouCam-related here was built during the hackathon submission period (31 Oct – 2 Nov 2026): the YouCam client, Skin AI profile, colour-science match engine, try-on shelf, voting, and the gift-pot flow. Reused from Chai Pot: the paisa-exact equal split, the pot/ledger idea, the audit log and the visual identity.

## Project layout

```
lib/youcam.ts     YouCam client: File API upload, task start + poll, feature wrappers
lib/service.ts    analyze() and tryOn(): live calls, quota, image persistence
lib/match.ts      hex -> Lab, undertone/depth, match scores with reasons (tested)
lib/pot.ts        proposals, votes, leader, lock, shares, chip-in, order (tested)
lib/seed.ts       demo pot with cached real YouCam outputs
app/api/...       REST routes (pots, photo, analyze, tryon, vote, lock, chip, img, health)
components/GiftPotApp.tsx   the whole pot UI
```

## License

MIT © 2026 Farah Khan
