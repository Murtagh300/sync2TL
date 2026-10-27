# Changelog

What changed in BlackVault, newest first. The version is `next/package.json`; what users see after
an update comes from `next/src/changelog.ts` (keep the two in step).

## 2.2.0 — 2026-10-27

**Desktop app** (`next/src-electron`, Electron 44)
- Windows (NSIS), macOS (dmg) and Linux (AppImage), built by the Desktop workflow into a draft release;
  updates through electron-updater once a release is published.
- Runs as https://wallet.blackvemarket.com from its own files (server paths go to the network), so the
  server, WalletConnect and BlackVeMarket work as on the web; its storage is its own.
- Takes `blackvault:` links from dApps, and `connex:` links when Sync2's desktop app isn't installed.
- Sandboxed page, no Node, no navigation away, links open in the browser, camera and clipboard only.

**Direct connection for dApps**
- `connect.js` on the wallet's domain: sign-in, transactions and certificates without WalletConnect; a
  window of its own that closes itself, or the desktop app.
- `/relay/` on the server (Sync2's protocol): each key written once, kept 10 minutes in memory.
- The sign page accepts sha-256 request ids and tells the dApp when its window is closed unanswered.

## 2.1.1 — 2026-10-26

Security review fixes:
- Signing with @noble/curves instead of elliptic (GHSA-848j-6mx2-7j84); the key is wiped after use, and a
  signer outside the wallet is refused.
- Push: only browser push services as endpoints; at most 50,000 watched addresses.
- Gateway: only the query parameters the wallet sends; the cache stays under 64 MB; .vet names pass again.
- Settings back-up: no nodes, error reports never switched on by a file, contacts shown before restoring.
- No localhost in the production CSP; the admin token is compared in constant time.
- Deploy: Caddy is recreated, so it serves the new wallet and Caddyfile.

## 2.1.0 — 2026-10-25

**Wallet**
- Push notifications for incoming VET, VTHO and tokens through the BlackVault server, also when the
  app is closed. No sign-in: the server only knows the addresses to watch.
- Encrypted back-up of settings (PBKDF2 + AES-GCM): contacts, notes, alerts, watchlist, scheduled
  payments, preferences and custom nodes. Never keys.
- Updates wait until the user taps Update; "What's new" after an update and from Meer.
- A banner when a service is down, when the server posts a notice, or when the version is too old.
- Features can be paused remotely (switched off only, never changed).
- Opt-in, scrubbed error reports.
- One network layer for every API: time-outs, retries with back-off, a circuit breaker per host and
  shared identical requests.
- Versioned storage migrations: broken values are set aside instead of stopping the app.

**Server and hosting** (new: `server/`, `deploy/`)
- API gateway for BetterSwap and BlackVeMarket's public data: whitelist, cache, rate limits.
- Push service, health checks and a status page, remote config, error reports.
- Caddy with security headers (CSP, HSTS, frame-ancestors) and Docker Compose.

**Development**
- CI on GitHub Actions, Playwright end-to-end and accessibility tests, ESLint.
- The legacy Sync2 app was removed from the repository root.
- Documentation: architecture, deploy and incident runbook, contributing.

## 2.0.10 and earlier

Built up in rounds from VeChain Sync2:

- **WalletConnect, StarGate, VeBetterDAO, market tools**, German and French.
- **Overview, watch-only wallets**, dust clean-up, consolidation and safety tools.
- **Look-alike address warnings**, pay many at once, Dutch.
- **Ledger support removed**; the security review's findings fixed.
- **Payment requests, encrypted messages, liquidity positions** and an emergency plan.
- **The BlackVeMarket market in the wallet**, notifications, portfolio insight.
- **Faster screens**, richer activity, safer sending, accessibility.
- **Home dashboard**, tabs, prices, onboarding.
- **Trading, readable signing, approvals, swap.**
- **BlackVeMarket NFTs**, token auto-detection; the blackvemarket.com look.
- **Vue 3 and Quasar 2**: every page and component ported from Sync2's Vue 2 code.
