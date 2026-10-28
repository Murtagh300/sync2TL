# Architecture

BlackVault is a wallet that runs in the browser (an installable PWA) and a small server next to it.
The wallet never needs the server to keep funds safe or to sign: everything that touches keys happens on
the device. The server makes the wallet faster, steadier and able to notify.

```
 device                                   wallet.<domain> (deploy/)                 outside
┌──────────────────────────┐   HTTPS   ┌────────────────────────────────┐
│ BlackVault (next/)        │──────────▶│ Caddy                           │
│  keys: encrypted vault    │           │  HTTPS, CSP, HSTS, static files │
│  IndexedDB + localStorage │           │   /            → wallet files   │
│  service worker (updates, │           │   /api /push /health /status    │
│  push)                    │           │   /config /errors → server      │
└────────┬─────────────────┘           └───────────────┬────────────────┘
         │                                             │
         │ directly: VeChain nodes (signing, balances)  ▼
         │ BlackVeMarket sign-in, push, fee delegation  BlackVault server (server/)
         │ WalletConnect relay, VeTrade                  gateway ─────────────▶ BetterSwap, BlackVeMarket (public data)
         ▼                                               push watcher ────────▶ VeChain nodes (transfer logs)
   outside services                                      health ──────────────▶ nodes, BVM, BetterSwap, WC relay
                                                         SQLite: subscriptions, reports
```

## The wallet (`next/`)

- **Vault** (`src/core/vault`): HD wallets (BIP-39/44), private-key wallets and watch-only addresses. Keys are
  encrypted with a key derived from the password (PBKDF2-SHA256, rounds tuned to the device, computed in a web
  worker) and only decrypted to sign.
- **Storage**: IndexedDB through Dexie (`src/core/storage`, versioned by Dexie) for wallets, activity and settings;
  localStorage for small preferences (`bv-*` keys), versioned by `src/utils/migrations.ts`.
- **Services** (`src/boot/services`): `bc` (Connex per network), `wallet`, `activity`, `config`, `bvm`
  (BlackVeMarket), `prices` (BetterSwap).
- **Network** (`src/utils/net.ts`): every HTTP client has time-outs, retries for reads, a circuit breaker per
  host and shared identical requests. Where data comes from is decided in one place: `src/utils/endpoints.ts`.
- **Signing**: `$signTx` and `$signCert` open the transaction and certificate dialogs (`src/pages/Sign`), which
  explain each clause, dry-run it and warn. WalletConnect requests go through the same dialogs.
- **Remote config** (`src/utils/remote-config.ts`): the server can pause a feature, post a notice and name the
  lowest version that is still fine. It can never change where funds go.
- **Updates**: the service worker downloads a new version in the background; it takes over only when the user taps
  Update (`src/utils/app-update.ts`). "What's new" comes from `src/changelog.ts`.

## The server (`server/`)

Node 24 running TypeScript directly (type stripping, no build step). One runtime dependency: `web-push`.
Storage: `node:sqlite` with recorded migrations (`src/db.ts`).

| Route | What |
| --- | --- |
| `GET /api/betterswap/*`, `GET /api/bvm/*` | gateway: only listed paths (`src/proxy.ts`), cached with stale-while-revalidate, rate limited per visitor |
| `/relay/*` | sign requests from dApps (`connect.js`, VeChain's relay protocol), in memory for 10 minutes, open CORS; see `docs/CONNECT.md` |
| `GET /health`, `GET /status` | the services the wallet depends on, as JSON and as a page |
| `GET /config` | remote config (`flags.json`, read again when it changes) |
| `GET /push/key`, `POST /push/subscribe`, `POST /push/unsubscribe` | push for incoming transfers |
| `POST /push/reminders` | a subscribed device's reminders (recurring buys), pushed when due |
| `POST /errors`, `GET /errors` | opt-in, scrubbed error reports; reading needs `ADMIN_TOKEN` |

- **Push watcher** (`src/push/watcher.ts`): every 10 s it reads the transfer and token-transfer logs for the
  watched addresses (at most an hour of blocks per round, so it catches up after an outage), and sends one
  notification per subscriber per transaction. Tokens outside the VeChain token registry are ignored (spam).
- **What the server knows**: push endpoints and the addresses to watch, and error reports with addresses,
  amounts, names and URLs removed (`src/scrub.ts`). No keys, no balances, no IP addresses in logs.

Settings are environment variables (`src/config.ts`): `PORT`, `ALLOWED_ORIGINS`, `TRUST_PROXY`, `DB_PATH`,
`FLAGS_FILE`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ADMIN_TOKEN`, `BETTERSWAP_URL`,
`BVM_URL`, `MAINNET_NODES`, `RATE_GATEWAY`, `RATE_WRITES`.

## Decisions

- **The wallet works without the server.** Without `SERVER_URL` it reads the public APIs directly, has no push
  for transfers and no remote config. Nothing about funds depends on the server.
- **Credentialed calls never go through the gateway.** Signing in to BlackVeMarket, its push and fee delegation
  go straight to BlackVeMarket, so its cookies and signatures are never seen by the gateway.
- **Same origin.** Caddy serves the wallet and the server under one domain: no CORS for the wallet's own calls,
  and the CSP can stay strict.
- **Remote config only switches off.** A compromised server could hide a feature or show a notice, nothing more.
- **One push subscription per device.** The browser ties a subscription to one sender's key, so a device has
  either BlackVeMarket's push or BlackVault's.
