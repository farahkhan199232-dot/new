# Chai Pot Live

Chai Pot Live is a Twitch chat game and OBS browser source overlay. Viewers contribute imaginary chai leaves to one shared community pot, propose group purchases, and vote together under rules set by the streamer. Leaves have no monetary value. The overlay is read-only for viewers and saves its session state in that browser's local storage.

## Run locally

```sh
npm install
npm run dev
```

Visit the local site, enter the Twitch channel and rules, then generate an overlay URL. The project is a static Vite site: `npm run build` writes deployable files to `dist/`. Use `npm test` to run the unit suite.

## Chat commands

- `!chip <n>` — add 1 or more leaves, up to the viewer's remaining session allowance.
- `!propose <amount> <what>` — propose spending leaves on something.
- `!vote <id> yes|no` — vote on a proposal. `!yes <id>` and `!no <id>` are shortcuts.
- `!veto <id>` — broadcaster or moderator closes an active proposal.
- `!brew <id>` — broadcaster or moderator force-passes an active proposal if its policy checks still pass.
- `!pot` — flashes the pot status on the overlay without sending a chat reply.

A proposal must be at or below the configured cap and current pot balance, and its proposer must have chipped at least one leaf. Viewers who chipped may vote once per proposal. A proposal brews as soon as the configured yes-vote threshold is reached and yes votes outnumber no votes. Otherwise it expires when its voting window ends.

## OBS setup

1. Deploy the site as a static Vite app, or run it locally for a preview.
2. Open the setup page and enter your channel and game rules.
3. Copy the generated overlay URL.
4. In OBS, add a **Browser Source**, paste the URL, and set its dimensions to **1280 × 720**.
5. Enable the source when you want the pot visible. Add `&transparent=1` to the URL for a transparent overlay background.

The query string includes `channel`, `cap`, `votes`, `window`, and `perViewer`. State persists in local storage per channel and browser. Add `&reset=1` once to clear that channel's saved session. Add `&demo=1` to mix clearly labelled simulated activity into a live session preview.

## Twitch connection

The overlay connects directly from the browser to Twitch's anonymous, read-only IRC WebSocket at `wss://irc-ws.chat.twitch.tv:443`. It uses Twitch's anonymous `justinfan` login and the public `SCHMOOPIIE` placeholder password, requests tags and commands, joins the channel, answers PING, and reconnects with backoff. No Twitch token, server, or secret is required. A connected browser source is needed for chat commands to affect the pot.

## Built with OpenAI Codex

This project was built with OpenAI Codex.

## License

MIT. See [LICENSE](LICENSE).
