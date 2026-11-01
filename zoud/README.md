# Chai Pot: The Split

A browser game about shared money, made for **Zoud GameLab 2026** (Zoud × Global Game Jam, theme *Make FinLit Fun*).
Four flatmates in Dubai, one shared Chai Pot, three months: split bills fairly, settle up in the fewest
transfers, save together for a Hatta weekend, and spot the scams in the group chat. English + Arabic.

- Play: open `game/index.html` in any modern browser (no build step, no network calls).
- Tests: `node game/money.test.js`
- Design document: [DESIGN.md](DESIGN.md) · Budget: [BUDGET.md](BUDGET.md)

The bill-splitting and settle-up math (`game/money.js`) is ported from the Chai Pot / SplitChai
group-wallet code in this repository (`lib/money.ts` splitEqual, SplitChai `simplifyDebts`).

Made by Farah Khan. MIT licence (see `../LICENSE`).
