# Chai Pot for SHGs

**An AI agent that keeps a women's self-help group's savings pot, in plain Hindi and English.**

Live: https://chai-pot-shg.vercel.app (demo group: `/g/demo`, sample data, not a real group)
Built for **Code for a Billion: Bharat Agentic-AI Hackathon 2026** (Code for India), impact area *Livelihood for the Uneducated*.

## The problem

India has about **92 lakh SHGs with 10.08 crore women** under DAY-NRLM (PIB, Ministry of Rural Development, Aug 2026). Every group meets monthly, collects savings (often ₹100 to ₹200 each), and lends the pot to members. The books are usually a paper register kept by one member who can read and write. That causes three everyday problems:

- **Members can't check their own balance.** Many members can't read the register, so they depend on the book-keeper's word.
- **Loan rules are applied by memory.** "3 times your savings", "no new loan until the old one is paid", "pay this month's saving first" get bent for some members and not others, and arguments follow.
- **Interest and instalments are hard to work out** on a reducing balance, so mistakes creep in.

## What it does

1. **Speak or type in any mix of Hindi and English**: "लता ने 200 जमा किए", "Asha ko 3000 ka loan chahiye 6 mahine", "Meena ki kist 545", "group ka hisaab". Voice input uses the phone's own speech recognition (hi-IN).
2. **The AI only reads the words.** Gemini turns the message into one structured action (who, what, how much). If the model is down, a keyword parser takes over.
3. **The group's own rulebook decides.** A deterministic engine (`lib/shg.ts`) checks every loan: 3× own savings, at most 50% of cash in hand, minimum months of membership, no second open loan, no unpaid savings, maximum tenure. It explains a "no" in plain words with numbers, and shows the most she can borrow.
4. **Nothing is saved until an office bearer taps Confirm.** Loans need 2 approvals from the leader and treasurer, never the borrower. Every entry goes into an append-only ledger, so the balance can always be recomputed from history.
5. **Everyone can hear their balance.** Tap a member to hear her savings, dues and next instalment read aloud in Hindi.

Rules are set per group when it is created (monthly saving, interest %, months before borrowing). No phone numbers, Aadhaar or bank details are collected.

## How AgentFoundry was used

The rules engine, its demo data and its test suite were first written by **AgentFoundry SMART-Code**, the agent inside the AgentFoundry IDE, in three agent sessions (create_file/edit_file tool calls against this project). Transcripts are in [`af-sessions/`](af-sessions/). The generated code was then reviewed and corrected by hand (month arithmetic, interest-once-per-month, borrower self-approval), and the UI, API and agent layer were added around it.

## Run it

```bash
npm install
npm test            # 15 tests for the rules engine (node --test)
npm run dev         # http://localhost:3000/g/demo
```

Optional environment variables:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Language understanding. Without it, the keyword parser is used. |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | Model names (default `gemini-3.8-flash`, fallback `gemini-2.5-flash-lite`). |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis for storage. Without them, data is kept in memory. |

Deploys as a standard Next.js app (Vercel or any Node host).

## Code map

- `lib/shg.ts`: rules engine (state from the ledger, loan checks, repayment plan, Hindi/English texts, validation)
- `lib/agent.ts`: message to action (Gemini structured output + keyword fallback), proposals for Confirm
- `lib/seed.ts`: sample group for the demo
- `app/api/groups/*`: create a group, read state, say, confirm
- `components/ShgApp.tsx`: the mobile screen

## Impact so far

None measured yet. This was built in November 2026 and is being offered to SHGs now. We will only report numbers from real groups.

## License

MIT
