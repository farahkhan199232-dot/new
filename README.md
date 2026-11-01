# Chai Pot ☕

> **Otari branch (`otari-wilding`)** for Mozilla.ai's *Developers Wilding: Online* hackathon. Every model call goes through the [Otari](https://otari.ai) hosted AI gateway to open-weight models, instead of calling Gemini directly. Live: https://chai-pot-otari.vercel.app/p/demo
>
> **What Otari does in Chai Pot**
>
> | Otari feature | Where it is used |
> |---|---|
> | Open-weight models, each with its own job | Qwen3.5 35B A3B reads spend requests and receipt photos and re-adds receipts; DeepSeek V4 Flash researches payees with web search; gpt-oss-20b is the budget tier-down model |
> | Model routing and fallbacks | Spend requests are sent to `model: "chai-pot-agent"`, an Otari routing policy: Qwen3.5 → fails over to DeepSeek V4 Flash at the gateway → tiers down to gpt-oss-20b when the member's budget is 80% used. A client-side second try covers timeouts. The audit log shows the policy and whether the gateway fell back (`Otari-Fallback` header) |
> | Web search (gateway-run `otari_web_search`) | When the policy engine holds a bill for approval, the agent checks the merchant on the web and gives approvers a risk note with real sources (advisory only) |
> | Code execution (gateway-run `otari_code_execution`) | Every receipt is re-added in Otari's Python sandbox (items + tax + service + tip vs printed total) instead of trusting model arithmetic |
> | Per-user budgets | `OTARI_API_KEY` is an Otari **service key**. Each call names the pot member behind it in `user` (`chai-pot:<pot>:<member>`), so Otari bills that member as an end user on the `chai-pot-member-daily` budget ($0.25/day each). A member over their allowance gets a clear "AI allowance used up, nothing was paid" message (HTTP 429, `ai_budget_exceeded`) |
> | Budgets and spending limits | The service key is capped by the `chai-pot-app-daily` budget ($3/day for the whole app), which pools every member |
> | Cost tags and traces | Every request carries `metadata` tags (`feature=spend-request / receipt-read / payee-web-check / receipt-code-audit`, `pot=demo/user`) and a `session_label` per pot, so the Otari dashboard shows each pot as one session with its tool spans and cost |
>
> The model only interprets. Group money rules (per-bill cap, daily cap, categories, approvals) are enforced by a deterministic policy engine the model cannot change; Otari's budgets cap what the *AI* may spend per member.

**A shared group wallet where an AI agent pays the group's bills, within limits the members set.**

Built for the PayPal AI Hackathon 2026. PayPal sandbox only: no real money moves.

**Live demo: https://chai-pot.vercel.app** (seeded demo pot: https://chai-pot.vercel.app/p/demo)

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
3. **Ask the agent (open-weight models via Otari)**:
   - **Receipt photo → itemized JSON** (merchant, line items, tax, total, category) and a suggested equal split you can adjust.
   - **Plain-language request** such as *"pay the ₹2,400 dinner at Saravana to host@example.com"* → the agent extracts amount, currency, payee, category and split, with its reasoning.
4. **Policy engine decides**: a deterministic rules engine checks funds, category, payee, per-bill cap and daily cap.
   - within limits → **auto-pay** via the **PayPal Payouts API** to the payee's email
   - above a cap → **held for N approvals**; the payout is sent when the last approval lands (funds/category re-checked at that moment)
   - disallowed category, no payee or not enough money → **rejected**
5. **Ledger + refunds**: each member's contributions, share of paid bills and balance. A member can take unspent money back with a **Captures refund (Payments API v2)** on their own PayPal payment, capped at their balance.
6. **Audit log**: every model interpretation (raw JSON included), policy check, approval, payout, refund and failure, newest first.

A **seeded demo pot** (`/p/demo`) lets judges click through immediately. Seeded entries are labelled *sample*; anything you do in the demo runs for real against PayPal sandbox and the Otari AI gateway. "You are …" switches which member you act as, so you can approve as someone else. "Reset demo" restores the seed.

## Architecture

```
Browser (Next.js App Router, mobile-first)
 ├─ PayPal JS SDK buttons ──► /api/pots/:id/paypal/order    ─► PayPal Orders v2: create
 │                         └► /api/pots/:id/paypal/capture  ─► PayPal Orders v2: capture → contribution
 ├─ Agent tab ─────────────► /api/pots/:id/agent/request    ─► Otari → Qwen3.5 (JSON)   ─┐
 │                         └► /api/pots/:id/agent/receipt   ─► Otari → vision + code exec│
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
| `lib/ai.ts` | Agent model layer: structured JSON calls through Otari with model fallback |
| `lib/otari.ts` | Otari gateway client, `otari_web_search` payee check, `otari_code_execution` receipt audit |
| `lib/paypal.ts` | PayPal REST: OAuth, Orders v2, Payouts v1, Captures refund; `PayPal-Request-Id` idempotency |
| `components/PotApp.tsx` | Pot UI: Pot / Agent / Bills / Audit tabs |
| `lib/seed.ts` | Seeded demo pot |

**Safety design**: the model only *interprets*. It never sees or sets limits as something it can change, and its system prompt tells it to ignore instructions that try to. Amounts for receipt payments come from the server-stored parse, not from the browser. Contributions are recorded only after a server-side capture. Payouts use a deterministic `sender_batch_id` per bill, so a retry can't pay twice. If PayPal or Otari credentials are missing, the UI says so and the API returns `503` with `paypal_not_configured` / `ai_not_configured`; nothing is ever marked paid without PayPal accepting it.

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
- Otari agent (open-weight models): receipt vision → itemized JSON, natural-language spend requests → structured intent
- Approval flow, audit log with model reasoning and policy checks
- Landing page, create-pot flow, seeded demo pot, new mobile UI

Removed: SIWE wallet sign-in (Chai Pot members are mostly identified by email, see "Known limitations").

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
| `OTARI_API_KEY` | yes | otari.ai API key (`otk_…`). Use a **service key** with a default end-user budget to get per-member AI budgets |
| `OTARI_MODEL` | no | Default `chai-pot-agent` (an Otari routing policy you create in Routing: Qwen3.5 35B A3B, fallback DeepSeek V4 Flash, budget tier-down gpt-oss-20b). Set `alibaba/qwen-3.5-35b-a3b` if you have no policy |
| `OTARI_VISION_MODEL` / `OTARI_SEARCH_MODEL` / `OTARI_TOOL_MODEL` / `OTARI_FALLBACK_MODEL` | no | Default `alibaba/qwen-3.5-35b-a3b` / `deepseek/deepseek-v4-flash-0731` / `alibaba/qwen-3.5-35b-a3b` / `deepseek/deepseek-v4-flash-0731` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | no | Upstash Redis / Vercel KV. Empty = in-memory (resets on restart) |
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
