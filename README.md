# Chai Pot ☕

**A shared group wallet where an AI agent pays the group's bills, within limits the members set.**

Built for the PayPal AI Hackathon 2026. PayPal sandbox only: no real money moves.

**Live demo: https://chai-pot.vercel.app** (seeded demo pot: https://chai-pot.vercel.app/p/demo)

> **Nebius x NVIDIA Global AI Hackathon build:** branch [`nebius-nemotron`](../../tree/nebius-nemotron), deployed separately at **https://chai-pot-nemotron.vercel.app**. The agent runs on **NVIDIA Nemotron models served by Nebius Token Factory**. See [NVIDIA Nemotron on Nebius Token Factory](#nvidia-nemotron-on-nebius-token-factory-hackathon-build). The `main` branch and https://chai-pot.vercel.app stay exactly as submitted to the PayPal AI Hackathon (Gemini).

## The problem

Every trip, shared flat and team outing has the same shape: one person fronts the villa, the cab and the dinner, then spends a week chasing everyone for their share. Joint accounts and shared cards fix the fronting but have no rules: anyone can spend anything.

AI agents can now pay for things, but a group will only let an agent touch shared money if **the group, not the model, decides the limits**.

## What Chai Pot does

1. **Create a pot**: name, members (by email or Base wallet), a per-member contribution target, and a spending policy:
   - per-bill cap
   - daily cap (in the pot's timezone)
   - allowed categories (food, groceries, transport, stay, …)
   - how many approvals a bill above a cap needs (from members other than the requester)
2. **Fund it with PayPal**: each member pays their share with PayPal Checkout (JS SDK buttons). The server creates the order and captures it with the **Orders API v2**, and records the contribution only from PayPal's capture response (amount, currency, `custom_id` = pot + member). Optional: USDC on Base through the pre-existing SplitChai settlement contract.
3. **Ask the agent (Gemini)**:
   - **Receipt photo → itemized JSON** (merchant, line items, tax, total, category) and a suggested equal split you can adjust.
   - **Plain-language request** such as *"pay the ₹2,400 dinner at Saravana to host@example.com"* → the agent extracts amount, currency, payee, category and split, with its reasoning.
4. **Policy engine decides**: a deterministic rules engine checks funds, category, payee, per-bill cap and daily cap.
   - within limits → **auto-pay** via the **PayPal Payouts API** to the payee's email
   - above a cap → **held for N approvals**; the payout is sent when the last approval lands (funds/category re-checked at that moment)
   - disallowed category, no payee or not enough money → **rejected**
5. **Ledger + refunds**: each member's contributions, share of paid bills and balance. A member can take unspent money back with a **Captures refund (Payments API v2)** on their own PayPal payment, capped at their balance.
6. **Audit log**: every model interpretation (raw JSON included), policy check, approval, payout, refund and failure, newest first.

A **seeded demo pot** (`/p/demo`) lets judges click through immediately. Seeded entries are labelled *sample*; anything you do in the demo runs for real against PayPal sandbox and Gemini. "You are …" switches which member you act as, so you can approve as someone else. "Reset demo" restores the seed.

## Architecture

```
Browser (Next.js App Router, mobile-first)
 ├─ PayPal JS SDK buttons ──► /api/pots/:id/paypal/order    ─► PayPal Orders v2: create
 │                         └► /api/pots/:id/paypal/capture  ─► PayPal Orders v2: capture → contribution
 ├─ Agent tab ─────────────► /api/pots/:id/agent/request    ─► Gemini (structured JSON) ─┐
 │                         └► /api/pots/:id/agent/receipt   ─► Gemini vision (receipt)   │
 │                         └► /api/pots/:id/agent/pay-receipt                            │
 │                                                       lib/policy.ts (deterministic) ◄─┘
 │                                                        ├ auto_pay  → PayPal Payouts v1
 │                                                        ├ needs_approval → wait for N approvals
 │                                                        └ reject
 ├─ Bills tab ─────────────► /api/pots/:id/spends  (approve | reject | retry | sync payout status)
 ├─ Refund ────────────────► /api/pots/:id/refunds ─► PayPal Payments v2: captures/:id/refund
 └─ USDC (optional) ───────► /api/pots/:id/usdc    ─► verify Settled event on Base
Storage: Upstash Redis (KV_REST_API_URL/TOKEN) or in-memory fallback for local dev
```

Key files:

| File | What it is |
|---|---|
| `lib/policy.ts` | Spending-policy engine (pure, unit tested) |
| `lib/ledger.ts` | Per-member ledger and refund caps (pure, unit tested) |
| `lib/agent.ts` | Agent orchestration: interpret → policy → pay/hold/reject → audit |
| `lib/gemini.ts` | Gemini REST client with JSON response schemas |
| `lib/paypal.ts` | PayPal REST: OAuth, Orders v2, Payouts v1, Captures refund; `PayPal-Request-Id` idempotency |
| `components/PotApp.tsx` | Pot UI: Pot / Agent / Bills / Audit tabs |
| `lib/seed.ts` | Seeded demo pot |

**Safety design**: the model only *interprets*. It never sees or sets limits as something it can change, and its system prompt tells it to ignore instructions that try to. Amounts for receipt payments come from the server-stored parse, not from the browser. Contributions are recorded only after a server-side capture. Payouts use a deterministic `sender_batch_id` per bill, so a retry can't pay twice. If PayPal or Gemini credentials are missing, the UI says so and the API returns `503` with `paypal_not_configured` / `ai_not_configured`; nothing is ever marked paid without PayPal accepting it.

## What changed vs SplitChai (pre-existing)

Chai Pot grew out of **SplitChai**, a project started before the hackathon: a bill-splitting web app where friends settle debts in USDC on Base through a small settlement contract.

Reused from SplitChai:
- The wagmi + viem + Base Account connector setup (`lib/wagmi.ts`) and the settlement contract ABI (`lib/contract.ts`)
- The deployed `SplitChaiSettlement` contract on Base mainnet (`0x4ce38dbb7eb76c9f801210dfc27c43bfd009fe15`), now used only for the optional USDC funding path, plus the "verify the `Settled` event before recording" pattern
- The Upstash-or-memory store pattern and the chai colour palette
- The `node --test` unit-test harness

New for the hackathon (everything else):
- The pot model: pooled funds up front instead of IOUs after the fact
- Spending policy engine (caps, categories, N-of-M approvals) and its tests
- Ledger with contributions, spend shares, refunds and balances, and its tests
- PayPal integration: Checkout buttons, Orders v2 create/capture, Payouts, Captures refund
- Gemini agent: receipt vision → itemized JSON, natural-language spend requests → structured intent
- Approval flow, audit log with model reasoning and policy checks
- Landing page, create-pot flow, seeded demo pot, new mobile UI

Removed: SIWE wallet sign-in (Chai Pot members are mostly identified by email, see "Known limitations").

## NVIDIA Nemotron on Nebius Token Factory (hackathon build)

Built during the Nebius x NVIDIA Global AI Hackathon (29-30 Oct 2026) on the `nebius-nemotron` branch.

Every model call in the agent goes to **Nebius Token Factory's OpenAI-compatible API** (`https://api.tokenfactory.nebius.com/v1/chat/completions`) with JSON-schema constrained output. Each Nemotron model has one job, sized to the task:

| Step | Model (Token Factory id) | Why this size | Code |
|---|---|---|---|
| Read a plain-language spend request ("pay the ₹2,400 dinner at Saravana to host@example.com") into amount, payee, category and split | **Nemotron 3 Nano** `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Runs on every request; fast and cheap keeps the chat responsive | `lib/gemini.ts` → `generateJsonNebius`, `lib/nebius.ts` → `nebiusChat` |
| Read a receipt photo into line items, tax and total | **Nemotron 3.5 Super VL** `nvidia/Nemotron-3.5-Super-VL` | Needs vision; the image is sent as an `image_url` data URL | same |
| Write a risk review for any bill the policy engine **held for approval**: unusual amount vs the pot's history, new payee, category mismatch, possible duplicate, unfair split | **Nemotron 3 Ultra** `nvidia/Nemotron-3-Ultra-550b-a55b` | Rare, high-stakes, needs real reasoning over the pot's history | `lib/nebius.ts` → `reviewHeldSpend`, `lib/agent.ts` → `addRiskReview` |
| Fallback when a model is busy or fails | **Nemotron 3 Super** `nvidia/nemotron-3-super-120b-a12b` | Same family, different capacity pool | `NEBIUS_FALLBACK_MODEL` |

Safety design is unchanged: the models only **interpret and advise**. The deterministic policy engine decides, PayPal executes, and the Ultra review is advisory text shown on the bill card and in the audit log (it can't approve, reject or pay). Model names and outputs are written to the audit log so judges can see exactly which Nemotron model did what.

Switch providers with `AI_PROVIDER=nebius|gemini` (default: Nebius whenever `NEBIUS_API_KEY` is set).

What was built during the hackathon (vs the PayPal AI Hackathon version on `main`):
- `lib/nebius.ts`: Token Factory client, Gemini-schema → JSON Schema converter, robust JSON extraction, Ultra risk review
- provider switch + Nemotron routing (fast / vision / reasoning / fallback) in `lib/gemini.ts`
- new `risk_review` audit entry and an advisory review panel on held bills (`lib/agent.ts`, `components/PotApp.tsx`)
- unit tests for the schema converter and JSON extraction (`lib/nebius.test.ts`)
- separate Vercel deployment with its own data prefix, so the PayPal build is untouched

## Setup and run

Requirements: Node 20+ (tested on Node 22).

```bash
cp .env.example .env.local      # fill in the values below
npm install --ignore-scripts
npm run dev                     # http://localhost:3000, demo pot at /p/demo
npm test                        # policy engine + ledger unit tests
npx tsc --noEmit                # type check (after one `next build` or `next dev`, which generate route types)
npm run build
```

Environment variables (see `.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | yes | Sandbox REST app credentials |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | yes | Same client id, for the JS SDK |
| `PAYPAL_API_BASE` | no | Defaults to `https://api-m.sandbox.paypal.com` |
| `NEBIUS_API_KEY` | yes (Nebius build) | Nebius Token Factory API key. When set, the agent uses NVIDIA Nemotron |
| `NEBIUS_FAST_MODEL`, `NEBIUS_VISION_MODEL`, `NEBIUS_REASON_MODEL`, `NEBIUS_FALLBACK_MODEL` | no | Override the Nemotron model ids above |
| `AI_PROVIDER` | no | `nebius` or `gemini` |
| `GEMINI_API_KEY` | yes (Gemini build) | Google AI Studio key |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.8-flash` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | no | Upstash Redis / Vercel KV. Empty = in-memory (resets on restart) |
| `STORE_PREFIX` | no | Redis key prefix (default `chaipot`); the Nebius deployment uses `chaipot-nemotron` |
| `DEMO_PAYEE_EMAIL` | no | Payee for the demo pot; defaults to the sandbox personal account below |
| `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_SETTLEMENT_ADDRESS`, `RPC_URL` | no | Optional USDC-on-Base funding |

No secrets are committed. `.env*.local` is git-ignored.

## PayPal sandbox test accounts

Create a REST app at [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → **Sandbox**, and put its client id/secret in `.env.local`. Payouts must be enabled for the app (it is by default in sandbox).

Accounts used for this project (passwords are in the PayPal developer dashboard under Testing Tools → Sandbox Accounts → View/Edit):

| Role | Sandbox account |
|---|---|
| Business (merchant the app is bound to; receives contributions, sends payouts) | `sb-rlimk53470972@business.example.com` (US) |
| Personal (pay with this in Checkout; also the demo payee for payouts) | `sb-syijz53572713@personal.example.com` (US) |
| Alternate India pair | `sb-m16jp53553789@business.example.com`, `sb-rsxdy53550085@personal.example.com` |

Try it:
1. Open `/p/demo`, pick a member who hasn't paid (Kabir), **Pot → Chip in**, pay with the sandbox personal account. The contribution appears with its PayPal capture id.
2. **Agent** tab: send *"Pay the $24 dinner at Saravana Bhavan to sb-syijz53572713@personal.example.com"*. It's under the $40 cap → paid instantly via Payouts; check the Audit tab.
3. Send *"Pay $95 for the villa deposit to sb-syijz53572713@personal.example.com"*. Above the cap → held. Switch "You are" to two other members and approve in **Bills**; the payout goes out on the second approval.
4. Send *"Buy a $30 speaker from …"*. Shopping isn't allowed → rejected with the failed check shown.
5. Upload a restaurant receipt photo, adjust the split, enter a payee email and pay.
6. **Pot → Your PayPal payments → Refund** returns your unspent balance to your PayPal.

Pot currencies are USD, EUR and GBP (PayPal sandbox payouts between US accounts). A request in another currency, such as ₹, is converted with an **indicative** fixed rate that is written to the audit log; it is not a live market rate.

## Known limitations (MVP)

- **Identity is demo-grade**: "You are …" is a member picker stored in the browser, so anyone with the pot link can act as any member. Next step: email magic links / PayPal login for email members and SIWE for wallet members.
- Pot data (including member emails) is readable by anyone with the pot link.
- No locking between concurrent writes to the same pot (last write wins).
- FX for non-pot-currency requests uses fixed indicative rates.
- Payout status is refreshed on demand ("Refresh status"), not by webhook.

## License

MIT, see [LICENSE](LICENSE).
