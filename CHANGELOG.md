# Changelog

What changed in BlackVault, newest first. The version is `next/package.json`; what users see after
an update comes from `next/src/changelog.ts` (keep the two in step).

## Unreleased

**Safety**
- Phishing check before connecting or signing: MetaMask's list and ours (on the BlackVault server), and
  sites that copy a VeChain project's name ("vebeterdao.org") or borrow it in their address.
- Panic button: revoke every approval and move everything to a safe place set beforehand, one
  transaction per address. Consolidate shares its sweep code.
- Swap: a token without a market price gets a warning, and price impact from the pool's depth.

**Trading and VeBetterDAO**
- Swaps ask VeTrade and BetterSwap's aggregator at once and take the better quote.
- Vote in the allocation round from the wallet (castVote), with a VePassport check before signing.
- X2Earn leaderboard (7 and 30 days), indexed by the server.
- Register a .vet name: commit, wait, register in VET, with the address record and primary name.

**Payments**
- Till: type a price in euros, show a QR code, see it paid (the amount carries its own last digits).
- Receipts as PDF (the print dialog) for any transaction and every till payment.
- Subscriptions with the token standard alone: subscribe = first period plus an allowance for 12;
  the seller collects everyone who is due in one transaction; cancel = allowance 0.

**Insight and help**
- What you earn: liquidity (value, APY, a year's expected income), StarGate and X2Earn in one place.
- Liquidity positions against holding (impermanent loss), from the chain's mint and liquidity events.
- Practice with test money: a testnet wallet, the faucet and a first payment, step by step.
- Spanish, Italian, Japanese and Korean.

**Messages**
- End-to-end encrypted chat between addresses, through the BlackVault server, with push for new messages.

**Round two: safety**
- Push for what leaves your addresses (transfers out, approvals given), so a key used elsewhere shows at once.
- Security check-up: also the panic button's safe place, outgoing push and the spending limit.
- Keystore files: import (Sync, Sync2, other VeChain wallets) and save one address's key as a keystore.

**Paying**
- Money links: crypto for someone without a wallet, through a link; picked up into their own wallet, or
  taken back. The link's key never reaches a server (it sits after the #).
- The fee from another address you hold (VIP-191): a child's or savings wallet needs no VTHO.
- Invoices with lines and VAT as PDF, paid in crypto and recognised when paid; a donate button (plain HTML).
- Till: a day overview with CSV, and an NFC sticker (or printed code) that opens the open sale on any phone.
- Web shop checkout: a shop per address, orders priced in VET or B3TR, seen paid on chain; a WooCommerce
  plugin (`next/public/integrations/woocommerce`) and a plain API for other shop systems.

**Trading and StarGate**
- Candles on the token chart, with a moving average and RSI.
- Validators compared (earnings per 10,000 VET last week, delegated, age, online) and a node NFT moved.
- VTHO tank: transactions left per address, a push when low, the surplus to VET in one tap.

**VeBetterDAO**
- A push when a new round starts, and "like last time" when voting.
- Your impact (CO₂, water, plastic and more) from the proofs X2Earn apps put on chain.
- DAO proposals (B3TRGovernor): read and vote for, against or abstain.

**Insight and tools**
- Monthly statement with start and end balances, as PDF. Token price alerts by push with the app closed.
- Well-known addresses named (VeChain's contracts, VeBetterDAO, StarGate, the token and NFT registries).
- Sign a message (a VeChain certificate) and check one.

**App**
- Simple mode: the balance and three big buttons. Six more languages: Portuguese (Brazil), Turkish,
  Vietnamese, Russian, Polish and Indonesian.
- Browser extension (`extension/`): VeChain sites find BlackVault where they look for a wallet.

**Round three: everyday**
- Send again: the last three payments on the home screen, one tap to the send page filled in.
- Send queue: put payments aside and send them in one transaction (one signature, one base fee).
- Clipboard check: a pasted address that looks like the one just copied but isn't is stopped.
- Currencies: GBP, CHF, JPY, CNY, KRW, AUD, CAD, BRL, TRY, PLN, IDR, SEK, NOK, DKK, CZK and INR, at the
  ECB's daily rates (the server's `GET /fx`, else Frankfurter).
- Help: twelve short topics and the glossary, searchable, offline, in all 15 languages.

**Round three: VeChain**
- Voting rewards: what VeBetterDAO's VoterRewards holds for you per ended round (with the Galaxy Member
  bonus), all rounds of an address claimed in one transaction.
- StarGate: stake VET into a new NFT (any open level), unstake an NFT no validator uses.
- Liquidity: add to and take out of BetterSwap V2 pools from the wallet (its router, exact approvals,
  1% slippage), or start a position in one of the largest pools.
- Discover: search, filter by the impact apps state, sort by B3TR per action (from the latest rewards).
- Impact goal for the year, with progress and whether it is on track.
- VTHO tank: since Hayabusa plain VET makes no VTHO (measured on mainnet); the tank now shows what
  your StarGate NFTs bring in a week, how many transactions that pays for and when the tank runs dry.
- Push: a voting reward to claim, your validator offline or leaving, a new token in the registry.

**Round three: overview**
- Connections: live WalletConnect sessions with "disconnect all", token approvals and signed sites.
- Year in review: a card to share with numbers only (transactions, days, busiest month, VET in and
  out, X2Earn actions and B3TR).

**Round four**
- SQUAD, B3TR and VOT3 always on the home screen and every address, with "Buy now" (a swap from VET;
  VOT3 through VeBetterDAO's convert).
- Holders of 10 million SQUAD or more wear the Squirtle Squad's sunglasses on their avatar and profile picture.
- All dApps: VeChain's App Hub and VeBetterDAO's apps in one list, by category; ours featured.
- Tokens: categories, add any token by its contract address, and tokens just live on BetterSwap
  (Token Forge graduates) one tap away, all marked as not checked. Token pages link the project's
  website (SHA: Safe Haven's own page).
- A loading animation of our own (a vault dial) instead of the stock spinners; placeholders glint in
  the accent colour. Calmer when the device asks for less motion.

## 2.3.0 — 2026-10-28

**UI polish**
- Home in one or two columns on a computer; slim tips; watch-only wallets marked; one wallet name.
- NFTs: one portfolio value, card numbers never cut off, for-sale and floor tags, equal listing buttons.
- Activity: a segmented filter and one Filter menu, token logos and NFT images, "Minted".
- Sentence-case labels, at most 2 decimals from 1,000, notices above the tab bar, one button system.

**What top wallets do, now in BlackVault**
- The fee in VET or B3TR instead of VTHO, through VeChain's generic delegator (VIP-194, as VeWorld):
  it adds its own payment clause and signs as gas payer; the wallet checks the returned transaction
  (only that clause, the gas and the nonce may change, the fee is capped) before the user signs.
- Risk labels before signing: brand-new or young contracts (their first block with code, from the
  node), a contract used for the first time, VET or tokens sent to a token contract, a transaction
  where several things leave and nothing comes back. A high risk asks once more.
- Token page: your average buy price (in VET, from a year of swaps) as a line on the chart, with +/-%.
- Tax export: a year of transfers, swaps and VTHO fees as a Koinly CSV; X2Earn rewards labelled.
- Discover: VeBetterDAO's X2Earn apps of this round, most voted first, and the B3TR each paid you.
- NFTs: select all, take several off sale in one transaction, hide several at once; watch-only
  wallets get no signing actions there.
- A public profile at /u/name.vet: BlackVeMarket name and avatar, a showcase, "Pay me" and share.
- Recurring and limit buys: a reminder (in the app, and by push from the BlackVault server) that opens
  the swap filled in; nothing is bought without signing.
- Buy VET: vechain.energy's ramp (card, iDEAL) or an exchange, with the address to withdraw to.
- Desktop: dApps open in a window of their own (own storage, no permissions); their wallet links come
  to BlackVault.

## 2.2.1 — 2026-10-27

**Fixes**
- The transaction status and transfer notifications watched an object that stays the same in Vue 3, so a
  sent transaction stayed "waiting for the chain" until a reload; they now follow the chain's head.
- Numbers follow the app's language (amounts, money, percentages); typed amounts accept a comma.
  VeBetterDAO's Max no longer misreads a grouped amount.

**UI/UX**
- Password field: focus, show/hide, the minimum length shown.
- Meer: groups, search, a settings button, the desktop app download on a computer; the Apps grid ships
  its logos. Settings regrouped (security, privacy, appearance); labels wrap.
- Home: a first-funds card for an empty wallet; top tokens fall back to BetterSwap's most traded tokens
  (24h pool volume) and show a retry when prices fail.
- Receive: the address in blocks of four, a VeChain-only note. Send: an empty-balance hint, message and
  note folded away, recent recipients as chips, bigger buttons.
- Setup: the backup opens after the checklist; six collections with listings and sales this month; the
  first wallet named in the app's language. The transaction bar offers "check again" and close after 2 min.

**Desktop app**
- Tray icon (Windows, Linux) with open, start with the computer, keep running when closed, and quit;
  closing the window keeps the app in the tray. Start with the computer (Windows, macOS), hidden.
- System notifications through Electron; a click opens the app. Tray words come from the app's language.

## 2.2.0 — 2026-10-27

**Desktop app** (`next/src-electron`, Electron 44)
- Windows (NSIS), macOS (dmg) and Linux (AppImage), built by the Desktop workflow into a draft release;
  updates through electron-updater once a release is published.
- Runs as https://wallet.blackvemarket.com from its own files (server paths go to the network), so the
  server, WalletConnect and BlackVeMarket work as on the web; its storage is its own.
- Takes `blackvault:` links from dApps, and `connex:` links when no other wallet app has them.
- Sandboxed page, no Node, no navigation away, links open in the browser, camera and clipboard only.

**Direct connection for dApps**
- `connect.js` on the wallet's domain: sign-in, transactions and certificates without WalletConnect; a
  window of its own that closes itself, or the desktop app.
- `/relay/` on the server (VeChain's relay protocol): each key written once, kept 10 minutes in memory.
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
- The legacy app was removed from the repository root.
- Documentation: architecture, deploy and incident runbook, contributing.

## 2.0.10 and earlier

Built up in rounds:

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
- **Vue 3 and Quasar 2**: every page and component ported from Vue 2.
