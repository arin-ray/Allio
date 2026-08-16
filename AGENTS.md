# AGENTS.md

## Cursor Cloud specific instructions

Allio is a chat bot for GroupMe / Facebook Messenger. `app.js` is an Express
server that receives webhooks and routes GroupMe slash-commands (`/depth`,
`/joke`, `/stock`, ...) to modules in `commands/`. Each command module exports
`run(message, callback)`; that is the core product surface. See `README.md` for
the general run/contribute flow and `allioConfig.json` for the command routing
table.

### Running the full server (`npm start`) is not possible in this environment

`node app.js` fails at startup with `Cannot find module './stantonConfig.json'`.
The server depends on secret config files that are intentionally not committed:

- `stantonConfig.json` — GroupMe/Facebook/Watson/Google/NewsAPI tokens (required by `app.js` and `commands/news.js`)
- `amznConfig.json` — Amazon Product API keys (required by `app.js`)
- `firebaseKey.json` — Firebase service-account key (required by `commands/bet.js`)

It also references npm packages that are **not** declared in `package.json`:
`body-parser` (app.js), `coin-ticker` (btc.js/eth.js), `firebase-admin`
(bet.js). Without real secrets these can't run meaningfully, so don't burn time
trying to boot the whole server — test the relevant command module directly
instead.

### How to run/verify a command without the server

Invoke a module exactly the way `app.js` does. No secrets needed for the
network-only commands (`depth`, `stock`, `ranks`, `stats`, `roast`) or the
offline ones (`cointoss`, `help`, `joke`):

```
node -e "require('./commands/depth.js').run('patriots', function(r){ console.log(r); process.exit(0); })"
```

The `/depth` command scrapes ESPN's public site, so it needs outbound network
(available here) and its output changes with the live NFL depth charts.

### Lint / test

There is no lint config and no automated test suite (the only npm script is
`start`). Use `node --check <file>` for a quick syntax check.

### Dependency note

`request` is not in `package.json` but many commands `require('request')`; it
resolves only because it is pulled in transitively by other dependencies. There
is no lockfile, so `npm install` is what wires this up.
