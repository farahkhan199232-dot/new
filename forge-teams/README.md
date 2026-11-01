# Chai Pot for Teams (Atlassian Forge)

Shared team budget pots (team lunches, offsites, tools) inside Jira and Confluence, with a Rovo agent, **Chai Pot Treasurer**, that checks spends against your team's policy.

Built for **Codegeist 2026** (Apps for Business Teams, finance; bonus: Best Agents with Rovo). This Forge app was written from 30 Oct 2026, inside the submission period.

Design rule: *the model interprets, code decides.* Rovo handles the language; a deterministic policy engine makes every approve / hold / reject decision.

## What's in the app (Forge modules)
| Module | Key | What it does |
|---|---|---|
| `jira:issuePanel` | chai-pot-issue-panel | Parses the expense in a work item (amount, currency, category, vendor), runs the policy, shows the verdict with reasons and risk flags, lets an approver approve or reject (requesters can't approve their own spend), logs to the pot ledger and comments the decision. |
| `jira:globalPage` | chai-pot-global-page | Pots dashboard: budget vs spent vs pending, ledger, approval queue, policy editor (auto-approve limit, hard cap, blocked categories), one-click demo seeding. |
| `macro` (Confluence) | chai-pot-balance-macro | Live pot balance card for team pages. |
| `rovo:agent` | chai-pot-treasurer | Rovo agent with 5 actions below. |
| `action` ×5 | get-pot-summary, check-spend, read-expense-item, log-expense, list-pending-approvals | Agent tools backed by Forge functions. |
| `rovo:mcp` | chai-pot-mcp | Exposes the read-only tools to MCP clients. |
| `trigger` | chai-pot-expense-created | Auto-reviews new work items labelled `expense`. |

Storage: Forge KVS. Jira access: Forge `requestJira` (asApp). No external services, no API keys.

## Setup
```bash
npm install
forge register        # sets your own app id in manifest.yml
forge deploy -e development
forge install --site <your-site>.atlassian.net --product jira
forge install --site <your-site>.atlassian.net --product confluence   # optional, for the macro
npm test              # policy engine unit tests
```

## Try it
1. In Jira open **Apps → Chai Pot for Teams** and press **Seed demo** with a project key (e.g. TEAM). It creates two pots and six realistic expense work items and reviews them.
2. Open any seeded work item: the **Chai Pot** panel shows the verdict; approve or reject held items.
3. In Rovo chat pick **Chai Pot Treasurer** and ask "How much is left in our team pots?" or "Can I expense a ₹3,000 team lunch at Big Chill Cafe?".
4. In Confluence insert the **Chai Pot balance** macro on a page.

## License
MIT, see LICENSE.
