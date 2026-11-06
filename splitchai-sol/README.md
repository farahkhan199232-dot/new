# ☕ SplitChai Sol

**Split the bill with friends, then settle every debt in USDC on Solana in one tap.**

Live demo: https://splitchai-sol.vercel.app · Sample group (no wallet needed): https://splitchai-sol.vercel.app/g/demo
Built for the MLH Solana Hackathon 2026 (DeFi track). **Devnet only, no real money.**

## What it does
- **Groups with invite links.** Create a group, share the link; friends pick their name and link a Phantom / Solflare / Backpack wallet (any Wallet Standard wallet via `@solana/wallet-adapter`).
- **Expenses** with equal or custom splits, exact to the micro-USDC (remainders are distributed deterministically, never lost).
- **Balances + minimal settle-up plan.** Greedy largest-debtor/largest-creditor matching: at most *n-1* payments for *n* people, chains collapse (A→B→C becomes A→C).
- **One-tap settle = one atomic Solana transaction.** "Settle all I owe" builds a single transaction containing, for every creditor:
  `CreateAssociatedTokenAccountIdempotent` + SPL **`TransferChecked`** → creditor, then one `TransferChecked` for the **0.3% fee** to the treasury ATA, and a **Memo** (`splitchai|g=<group>|n=<nonce>|legs=<k>`) signed by the payer. All transfers land together or none do.
- **Receipts verified server-side.** The app never trusts the client: `/api/groups/:id/settle` fetches the confirmed transaction from Solana devnet (`getParsedTransaction`), checks it succeeded, the memo tags this group, the mint is the group token, the payer and every recipient are group members, and the signature was not already used. Only then are balances updated.
- **Devnet test-token faucet.** `tUSDC` (6 decimals) is a self-created devnet SPL mint; `/api/faucet` mints 100 tUSDC (+0.01 devnet SOL for fees) to any wallet. The mint-authority key is a devnet-only server key; the app never sees user keys.

## Why Solana
A ₹200 chai split is a $2 debt. On most chains the fee eats the payment; on Solana a settle that pays three friends and the fee in one go costs **5,000 lamports (~$0.0005)** and confirms in **under a second** (our devnet E2E: 0.92 s). Multiple SPL transfers in one atomic transaction make "settle everything I owe" a single signature instead of a payments chore.

Verified devnet settle (2 creditors + fee + memo in one tx):
https://explorer.solana.com/tx/2UDji3M18V81NRMcraFy8riSrzSXuNVkNSSs8w7iEXm6cTPCSzKTHHqhyeg1AbvSSCWZzEZ6BARWqrb7e6FVHyVC?cluster=devnet

## Stack
Next.js 16 (App Router) · `@solana/web3.js` 1.99 · `@solana/spl-token` · `@solana/wallet-adapter-react(-ui)` · Upstash Redis (in-memory fallback) · Vitest.

| Path | What |
|---|---|
| `lib/split.ts`, `lib/balances.ts`, `lib/money.ts` | split math, net balances, settle plan, fee |
| `lib/tx.ts` | settle transaction builder (multi-leg TransferChecked + fee + memo) |
| `lib/verify.ts`, `lib/chain.ts` | server-side receipt verification from devnet |
| `app/api/*` | groups, members, expenses, settle (verify), faucet, health |
| `components/GroupView.tsx` | group UI, wallet settle flow, `/g/demo` sample group |
| `scripts/e2e.mts` | end-to-end devnet test against a running app |

## Run it
```bash
npm install
npm test            # split/settle math + tx builder + verifier unit tests
npm run dev         # http://localhost:3000  (/g/demo works with no wallet)
```
Env (all optional for local): `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Upstash), `MINT_AUTHORITY_SECRET` (devnet keypair JSON that is mint authority of `NEXT_PUBLIC_MINT`, enables the faucet), `NEXT_PUBLIC_MINT`, `NEXT_PUBLIC_TREASURY`, `NEXT_PUBLIC_RPC_URL` (defaults to devnet), `NEXT_PUBLIC_DEMO_SIGNATURE`.

E2E on devnet: `BASE=http://localhost:3000 KEYS=./keys npx tsx scripts/e2e.mts` (needs funded devnet test keypairs `alice.json`, `bob.json`, `cara.json`).

## What's next
Solana Pay QR / settle links for friends without the app, Circle devnet→mainnet USDC, sign-in-with-Solana wallet ownership proof when linking, recurring group expenses, and an Anchor escrow for "pot" style trips.

## License
MIT
