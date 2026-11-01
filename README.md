# SplitChai Pot Copilot

**Split group bills by talking or tapping. An AI copilot does the busywork; your group's rules, and real people, stay in charge.**

Built with [Agent-Native](https://www.agent-native.com) for the Builder.io Agent-Native Hackathon (Oct 27 – Nov 9, 2026).

- Live app: https://splitchai-copilot.vercel.app (sign up with any email; no verification)
- Code: this branch (`builderio-agent-native`), MIT

## The problem

Every group trip or shared flat ends with someone scrolling a WhatsApp thread, re-typing bills into a splitting app, and arguing about who paid for what. AI can parse the mess, but nobody wants an AI quietly adding a ₹9,000 villa to their tab.

## What it does

A **pot** per trip, flat or dinner club. One screen shows: add-a-bill form, bills waiting for approval, live balances, fewest-payments settle-up, every expense, the group's rules, and an activity log that marks who did what (you or the agent).

The agent sits in the sidebar and calls the **same actions** as the buttons:

- *"Dinner at Thalassa 2400 paid by Aisha, everyone except Ravi"* → one expense, split ₹800 × 3.
- Paste a receipt or a chat log → `add-expenses` adds every line in one transaction.
- *"Who owes whom?"* → reads balances and the minimal transfer plan.
- *"Raise the per-bill cap to 5,000"* → `update-rules`.

## People and agent, on the same rules

Every expense, from the form or the agent, runs through one deterministic rules engine (`server/lib/splitchai.ts`):

| Result | When | What happens |
|---|---|---|
| counted | within all rules | counts toward balances now |
| needs approval | over the per-bill cap or the daily cap | waits for a member to tap **Approve** |
| blocked | category the group disallowed | stored with the reason, never counted |

`review-expense` refuses agent callers (`403 human_approval_required`), so the agent can file a bill but can never approve one. The pot row is locked per write so two bills can't race past the daily cap. Splits are integer paise and always sum to the bill.

## How Agent-Native is used

- **One action layer** (`actions/*.ts`, `defineAction`): 10 domain actions used by the React UI (`useActionQuery` / `useActionMutation`), the agent (tools), and HTTP/MCP/A2A for free.
- **Shared SQL state** (Drizzle + Postgres): the UI refreshes the moment the agent writes.
- **Context awareness**: the open pot is in `navigation.potId`, so "add this to the trip" just works.
- **`ctx.caller`** separates people from agents for the human-only approval rule; `source` badges show who added each bill.
- **Agent chat sidebar** + "Tell the copilot" box that hands text to the agent with the pot as context.
- Open-weight model via an OpenAI-compatible endpoint (Nebius Token Factory, `Qwen3-235B-A22B-Instruct-2507`).

## What existed before vs. what's new

- **Template**: generated with `npx @agent-native/core create --template chat` (commit `Initial commit from agent-native create`). The chat shell, auth and agent sidebar are the framework's.
- **Reused (adapted)** from Chai Pot (github.com/farahkhan199232-dot/new, `main`, MIT, built Oct 2026): integer-money helpers, the equal-split-with-leftover-paise function, and the shape of the deterministic policy engine (category / per-bill / daily caps).
- **New during the hackathon (Nov 2026)**: everything else: the pot/member/expense/settlement/activity schema, all 10 actions, exact/percent/shares splits, approval workflow with the human-only rule, balances from expenses + settlements, minimal settle-up transfers, the `/pots` UI, agent prompt and tool set, tests.

## Run it

```bash
pnpm install
cp .env.example .env   # DATABASE_URL optional locally (PGlite); add an LLM key
pnpm dev
pnpm test              # rules, splits, balances, settle-up
```

Deploy: see the Vercel guide in the Agent-Native docs (`NITRO_PRESET=vercel pnpm build`, `vercel deploy --prebuilt --prod`, `pnpm migrate:production`). Env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `OPENAI_API_KEY` + `OPENAI_BASE_URL` (or any supported provider key), `AGENT_ENGINE`, `AGENT_MODEL`.

## Limits (honest)

Recording only: no money moves through the app (settle up by UPI/cash, then tap *Mark paid*). One approval role (any member). No receipts OCR beyond what the model reads from pasted text.
