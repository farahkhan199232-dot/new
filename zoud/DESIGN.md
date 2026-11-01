# Chai Pot: The Split — Concept & Initial Game Design Document

**Jam:** Zoud GameLab (Zoud × Global Game Jam), theme *Make FinLit Fun*  
**Developer:** Farah Khan (solo), India · farahkhan199232@gmail.com  
**Platform:** Browser (HTML5, no install, works on desktop and mobile), English + Arabic  
**Version:** Jam build 1.0, November 2026 · Code under MIT licence

---

## 1. One-line pitch
Four flatmates, one shared pot, three months of bills, birthdays and bad links. You keep the
**Chai Pot**: split every bill fairly, settle everyone up in the fewest transfers, save together
for a weekend in Hatta, and catch the scams hiding in the group chat.

## 2. Why this game
Most money conflicts young adults face are **shared money** problems, not stock-market problems:
who owes whom after dinner, the friend who never pays back, the group trip that never gets
funded, the "new number" asking for money. These are especially common for people sharing flats,
whether students or the many young professionals who move to the UAE for work. *The Split* turns
those everyday moments into short puzzles where the right financial habit is also the winning move.

## 3. Audience
- **Primary:** 18–30 year olds who share housing, bills or trips (students, young professionals,
  expat flat-shares in the UAE and the Gulf).
- **Secondary:** secondary-school and university financial-education classes (ages 15+), employers'
  financial-wellbeing programmes, banks' and fintechs' youth onboarding.
- **Prior knowledge needed:** none. Every concept is introduced through a concrete situation.

## 4. Learning outcomes
After one playthrough (about 10–12 minutes) a player can:
1. Split a bill by what each person consumed, with tax (5% UAE VAT) shared in proportion, and
   explain why an equal split can be unfair.
2. Work out each person's **net balance** (paid minus share) and settle a group in the fewest
   payments by pairing balances that cancel.
3. Choose a saving plan that is automatic ("pay yourself first") and proportional to income.
4. Keep an emergency buffer separate from goal savings, and put clear terms on loans to friends.
5. Recognise the red flags of common scams: OTP requests, "you won" fees, "new number" money
   requests, overpayment refunds, look-alike bill-payment links and "guaranteed" returns.

## 5. Core loop
Each in-game **month** is one short chapter with four stages:

| Stage | Player action | Concept | Win condition |
|---|---|---|---|
| 1. Split the bill | Read the flat's group chat; tap who shared each receipt line; apply house rules (birthday treat) | Itemised vs equal split, proportional tax | Every line matches what people said |
| 2. Settle up | Tap a person who owes, then a person who is owed; each transfer moves as much as it can | Net balances, debt simplification | All balances at zero; stars for fewest transfers vs. the computed minimum |
| 3. Save together | Make one decision on the shared Hatta trip jar (goal AED 1,800) | Pay-yourself-first, income-proportional saving, emergency fund, loans to friends, investment scams | Consequences play out in later months |
| 4. Spot the scam | Judge 3 phone messages: legit or scam | Red flags | Each correct call adds to the Scam Shield |

Three persistent meters tie the stages together: **Harmony** (how the flat feels about money),
the **Trip jar** and the **Emergency buffer**, plus **Scams caught**. Decisions carry forward:
the saving plan chosen on Month 1 pays in automatically every payday; a loan with no plan comes
back as an awkward, unpaid debt in Month 3; a "guaranteed" investment empties the jar.

### Progression
- **Month 1 · Karak Night** — one payer, 5 items, tutorial-length. Players can try "Just split equally" and see that Maria would pay AED 22.05 for AED 9.45 of food.
- **Month 2 · Aisha's Birthday** — a house rule (the birthday person pays nothing) and an allergy clue; the emergency-loan dilemma.
- **Month 3 · Bills Day** — groceries with personal and shared items, plus DEWA and internet paid by different people. The settle-up has two exact pairs, so the minimum is 2 transfers instead of 3 — the "aha" moment.

### End of game
A report card (fair splits, settle stars, jar vs. goal, buffer, harmony, scams caught), a title
(Chai Pot Champion / Smart Splitter / Learning the Ropes) and the five take-aways in plain language.

## 6. Mechanics in detail
- **Money is exact.** All amounts are integer fils. Line items split equally among the people who
  shared them; leftover fils go to the first people so shares always add up to the receipt.
  VAT is shared in proportion to each person's subtotal (largest-remainder rounding). This math is
  ported from the Chai Pot / SplitChai group-wallet code (same `splitEqual` and debt-simplification
  functions) and is covered by unit tests.
- **Fewest transfers.** The minimum number of transfers is computed exactly:
  (people with a non-zero balance) − (largest number of groups whose balances sum to zero).
  Players earn 3 stars at the minimum, 2 stars at one extra, 1 star otherwise.
- **Feedback, not quizzes.** Wrong receipt lines shake and turn red and the game points back to the
  chat; a wrong scam call explains the specific red flags as tags. Nothing blocks progress for long.
- **No grind, no timers.** Each decision can be read at the player's own pace.

## 7. Financial accuracy notes
- UAE VAT standard rate is 5% and applies to restaurant bills and most groceries; the game uses 5% throughout.
- The game never presents interest-bearing debt as normal; the only "loan" is between friends, and
  the lesson is about clear repayment terms. Saving is shown as setting money aside, not as returns.
- "Guaranteed" or very high returns are always shown as scams; the investment lesson is that real
  investments carry risk and a near-term goal (a trip weeks away) belongs in safe savings.
- Scam scenarios follow the patterns banks and regulators commonly warn about (never share an OTP;
  verify "new number" requests by calling the known number; check your real balance, not a
  screenshot; pay bills only through official channels). DEWA appears only as the real bill that
  a scammer imitates; the scam domain is fictional.
- All characters, businesses, numbers and domains are fictional.

## 8. Regional perspective & localisation
- Full **Arabic** version with right-to-left layout, chosen on the title screen or in Settings
  (defaults to Arabic when the browser language is Arabic).
- **AED** throughout, UAE 5% VAT, DEWA electricity & water, karak at a corner cafeteria, mandi and
  kunafa, a weekend in Hatta, a flat-share mixing Emirati, South Asian and Filipino flatmates as is
  common in Dubai — written to avoid stereotypes (Aisha is a nurse, Rohan an engineer, Maria a
  junior designer on the lowest salary, which is what makes the equal-vs-proportional choice matter).
- Planned for the full game: a **jam'iya** (rotating savings circle) chapter, Zakat basics,
  Ramadan and Eid spending, remittances home, and Islamic-finance-friendly savings framing.

## 9. Accessibility & inclusion
- Text size (3 steps), high-contrast mode, reduce-motion mode (also follows the OS setting), sound on/off.
- Colour-blind-safe palette (Okabe–Ito) and every person has a letter **and** a distinct ring style
  (solid, dashed, double, dotted), so nobody is identified by colour alone.
- Sound is optional and never carries information on its own: every sound is paired with an on-screen
  message, and messages are announced to screen readers through a live region.
- Fully playable by mouse, touch or keyboard (real buttons, visible focus rings, Esc closes dialogs).
- Plain language, short sentences, no timers, mistakes are explained rather than punished.

## 10. Technology
Plain HTML, CSS and JavaScript (no engine, no frameworks, no tracking, no network calls), about
90 KB total, so it loads instantly on low-end phones and school computers. Settings are saved in the
browser's local storage. Source: https://github.com/farahkhan199232-dot/new/tree/zoud-split/zoud

## 11. What the full game adds (development plan)
1. **Content:** 12 months (a full "year in the flat") with ~40 bills, 40 scam messages, 12 saving
   decisions; new mechanics for a jam'iya savings circle, rent deposits, salary advances and BNPL,
   remittances, and Zakat.
2. **Modes:** a classroom mode with teacher dashboard and pre/post quiz for measuring learning; a
   "real receipt" mode where players photograph a bill and split it (bridging to the Chai Pot app).
3. **Presentation:** illustrated characters and venues, voiced chat lines in Arabic and English,
   original music.
4. **Accessibility:** screen-reader-complete flows, dyslexia-friendly font option, simple-language mode,
   Urdu/Hindi/Tagalog localisation for the UAE's largest communities.
5. **Distribution:** web, Android/iOS (wrapped), and partner embeds.

See `BUDGET.md` for the production budget and milestones.

## 12. Commercial potential
- **B2B licensing** to banks, fintechs and employers' financial-wellbeing programmes (white-label
  chapters, branded scam-awareness packs), and to schools/universities (classroom licence).
- **Free consumer version** on web and mobile as the funnel; no ads to minors, no dark patterns.
- **Bridge to a real product:** the game's split/settle math is the same as the Chai Pot shared-wallet
  app the developer is building, so players can take the habit into real life.

## 13. Risks and how we handle them
| Risk | Mitigation |
|---|---|
| Financial or cultural inaccuracy | Paid review by a UAE financial-education adviser and an Arabic cultural/language reviewer every milestone |
| Feels like a quiz | Every lesson is a mechanic with consequences; text is optional feedback |
| Scope creep | Monthly content drops on a fixed template; mechanics frozen after milestone 2 |
| Accessibility gaps | External accessibility audit before launch; playtests with diverse players |
