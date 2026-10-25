# BlackVault – next

The BlackVault wallet being rebuilt on Quasar 2, Vue 3 and Vite.
The current app in the repository root keeps working until this folder replaces it.

Requires Node 24 (see `../.nvmrc`).

```bash
npm install
npm run dev          # http://localhost:8090
npm run build        # PWA into dist/pwa
npm run typecheck
npm test             # core tests against next/src
npm run test:legacy  # the same tests against the current app in ../src
```

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Test checklist (`../docs/TEST-CHECKLIST.md`), core tests | done |
| 1 | Quasar 2 + Vite toolchain, theme, assets, i18n, `core/` | done |
| 2 | Boot files and global services | done |
| 3 | Router and stack navigation | done |
| 4 | Pages and components | done |
| 5 | Electron | – |
| 6 | Mobile (Capacitor) | – |
| 7 | Lint, CI, cleanup | – |

The web app (SPA/PWA) is feature complete. Checked in the browser against mainnet
(see `../docs/TEST-CHECKLIST.md`): wizard, create/import (known BIP39 vector), backup and
verification, wallets/addresses, rename/delete, password change, settings (language,
tokens, nodes), address/asset pages, send form, transaction dialog (estimation, warnings,
priority), certificate signing, the dApp sign flow over a (local) relay, activities.

Not checked yet: broadcasting a real transaction (needs testnet funds), transfer history
and notifications with real transfers, Ledger (needs a device), PWA install/update.

Platform hooks left for later phases: `utils/external-url.ts`, `utils/bio-pass.ts`,
`utils/clipboard.ts`, `utils/open-url.ts`, the update tip (phase 5 desktop, phase 6 native).

## Porting notes

- **Options API** is enabled (`build.vueOptionsAPI`); app-vite 3 turns it off by default.
- **Global helpers** (`$svc`, `$state`, `$axios`, `$dialog`, `$loading`, `$backOrHome`,
  `$netDisplayName`, `$onWindowEvent`) are `app.config.globalProperties`, typed through
  `declare module 'vue' { interface ComponentCustomProperties }`. Outside components use
  `useSvc()` from `boot/services`.
- **`$dialog`** passes every option except Quasar's own to a custom `component` as props
  (Quasar 2 wants `componentProps`); call sites stay as they were.
- **asyncComputed** (vue-async-computed 4): declare each key in `data()` as
  `key: null as T | null` for typing, see `src/shims-async-computed.d.ts`.
- **Stack navigation** (`src/router/stack.ts`, replaces vue-router-stack): the depth of a
  page is vue-router's `history.state.position` minus the position the tab opened the
  app at (kept in sessionStorage, so reloads keep it). `StackedRouterView` finds its own
  route record through vue-router's `matchedRouteKey`/`viewDepthKey`; note that the
  Options API `inject` unwraps refs. Pages under `layouts/Main` get their route params
  and query as props. `pages/StackDemo.vue` (temporary) exercises push, back, replace,
  swipe-back and reload.
- **Vue 3 changes applied across the pages** (watch for these in new code too):
  `v-model` on own components uses `v-model:<prop>` + `update:<prop>` (the `model` option is
  gone); declare `emits` (undeclared listeners fall through to the root element);
  `<template v-for>` carries the `key`; a bare nested `<template>` must be
  `<template v-slot:default>`; no `this.` in templates; `$once('hook:…')` became
  `beforeUnmount`; Quasar dialogs are teleported, so `this.$el` of a dialog component is
  not its DOM (use the QDialog ref's `contentEl`).
- **Dark theme**: no light-theme classes (`bg-*-1`, `text-dark`); use `bg-surface`,
  `bg-surface-2`, `text-white`.

## Design (blackvemarket.com)

Tokens live in `src/css/quasar.variables.sass`, the shared layer at the end of
`src/css/app.sass`. Geist is bundled (`@fontsource-variable/geist`), icons are the
outlined Material set (`o_…`).

- `bvm-tile`: the site's surface (white 3.5%, 1px white 10% border, 10px radius)
- `bvm-display`: heavy headline type (900, tight) for titles and big amounts
- `bvm-amount`: heavy, even-width digits for amounts in lists
- `bvm-label` (also every `q-item-label header`): small mint section label
- Primary action: `color="primary" unelevated` (mint, dark text). Secondary:
  `outline color="primary"` renders dark with a white hairline, as the site's "View all".
- One loud thing per screen: the balance or amount. Mint only for actions and status.

## Core tests

`test/core` pins the stored-data formats with values generated independently of the
app (ethers for HD keys, Node crypto for the cipher format, see `test/fixtures.ts`).
Run both `npm test` and `npm run test:legacy` after touching `src/core`: if either
fails, wallets saved by an earlier version may no longer open.

## BlackVeMarket integration

- `src/boot/services/bvm.ts` talks to the BlackVeMarket API (`/profile`, `/nft`, `/wallet/:addr/vet-name`, `/rates`), mainnet only.
- The BVM API sends no CORS headers. `quasar dev` proxies it through `/bvm-api`; a production build calls
  `https://blackvemarket.com/api` directly, so the backend must allow the wallet's origin
  (or set `BVM_API_URL` at build time to a proxy that does).
- Asking `/profile/:addr` for an address BlackVeMarket has never seen creates a profile row for it.
- NFTs: the address page has an NFTs tab (`pages/Address/NftGrid.vue`), each NFT opens `pages/Nft`
  (traits, last sale, send as ERC-721 `transferFrom` or ERC-1155 `safeTransferFrom`); the sign dialog
  recognises NFT transfers (`decodeAsNftTransferClause` in `pages/Sign/helper.ts`).

## Token auto-detection

`src/utils/tokens.ts` dry-runs `balanceOf` for every registry token in batches of 40 clauses through
`thor.explain`, and shows every token with a balance next to the ones switched on in Settings › Tokens.
Results are cached for 5 minutes per address; the token registry itself refreshes every hour.

## Beyond Sync2 and VeWorld

- **Readable signing** (`src/utils/actions.ts`, `describe-action.ts`, `simulate.ts`): every clause the wallet
  recognises is shown as a sentence ("Give BlackVeMarket access to all your Squad Pop NFTs"), unlimited and
  collection-wide approvals are flagged, and the dry run shows what leaves and arrives ("−100 VET, +1,124 VTHO").
- **Approvals** (`pages/Approvals`, `utils/approvals.ts`): open token allowances and NFT operator approvals from the
  logs, checked on chain, with revoke and revoke-all.
- **BlackVeMarket trading** (`utils/market.ts`, `pages/Nft`): list, change price, cancel, accept offers, bulk send and
  bulk list (NFTs tab › Select), and launchpad mints (`pages/Launchpad`). These build the same clauses as
  blackvemarket.com on each collection's marketplace contract; BVM pays the gas via `/api/delegate/sign` when it
  sponsors the wallet.
- **Watchlist and alerts** (`pages/Watchlist`, `utils/alerts.ts`): collections and wallets to follow, floor price
  alerts and new offers on your NFTs, checked every 5 minutes while the app is open.
- **Names and contacts** (`utils/names.ts`, `pages/Contacts`): contacts and .vet names (vet.domains, on chain) show
  instead of addresses everywhere; the recipient field takes `name.vet`.
- **Payment requests** (`utils/payment-request.ts`, `pages/Address/ReceiveDialog.vue`): a QR code or link with an
  amount that fills in the send form.
- **Swap** (`pages/Swap`, `utils/swap.ts`): quotes and routes from VeTrade's API (CORS open), checked before signing,
  with BetterSwap's on-chain aggregator as fallback.

Production needs CORS on the BlackVeMarket API for the wallet's origin on: `/api/profile/*`, `/api/nft/*`,
`/api/collections`, `/api/activity`, `/api/launchpad/public`, `/api/delegate/status` (GET) and
`/api/delegate/sign` (POST, JSON). Hosting the wallet on blackvemarket.com itself avoids that.

## Modern wallet UX

- **Home** (`pages/Index`): total value in € or $ with the 24h change and a 7 day line, quick actions (send,
  receive, swap, scan) and a wallet switcher; a bottom tab bar (`components/TabBar.vue`) for Home, NFTs, Swap,
  Activity and More. Search (`pages/Search`) covers contacts, tokens, collections, .vet names and addresses.
- **Prices** (`boot/services/prices.ts`): BetterSwap's `token-prices/stats` and `token-prices/history`, in euros via
  BlackVeMarket's `/rates`. BetterSwap sends no CORS headers: `quasar dev` proxies `/betterswap-api`; a build needs
  `BETTERSWAP_API_URL` pointing at a proxy, otherwise only VET, VTHO and B3TR get a price (from BlackVeMarket).
- **Feedback**: a transaction status pill over every page (`components/TxStatusBar.vue`), success screens
  (`components/SuccessDialog.vue`), haptics, and a check before paying a new address (`pages/Send/RecipientCheckDialog.vue`).
- **NFTs**: fullscreen viewer with zoom and swipe (`pages/Nft/NftViewer.vue`), sorting and listed/unlisted filters,
  suggestions on an empty address.
- **Preferences** (`utils/prefs.ts`, Settings › Appearance): accent color, currency, hidden balances, haptics.
  Colors go through `--q-primary`, so the accent applies everywhere.
- **Onboarding**: three visible steps, a password strength meter, and following a first collection.

## Speed, activity and safety

- **Instant screens**: the last balances, portfolio and first NFT page are kept (`utils/snapshot.ts`) and shown
  at once while fresh data loads; skeletons where nothing is known yet. An offline bar (`components/OfflineBar.vue`)
  says when the device is offline; signing then waits for a connection, and sending a signed transaction waits
  for the network instead of using up its retries.
- **NFT card → page**: the picture morphs into the NFT page with the View Transitions API (`utils/hero.ts`).
- **Tokens**: price chart (1D/1W/1M, BetterSwap history) with your transfers as dots; pin and hide tokens
  (hidden ones come back in Settings › Tokens).
- **Spam**: NFTs from collections BlackVeMarket doesn't verify, and incoming tokens outside the token registry, stay
  out of sight (`utils/hidden-nfts.ts`); any NFT can be hidden or shown by hand.
- **Activity**: grouped by day, with what others sent you (`utils/incoming.ts`), and a page per transaction
  (`pages/TxDetail`): what changed for you, fee, block, your note, send again, save as contact.
- **Send**: type the amount in € or $, 25/50/75%/Max, and a note kept on this device (`utils/tx-notes.ts`).
- **Security**: a check-up with a score (`pages/Security`), the sites you signed for (forget one to remove its
  records), and auto-lock after time in the background with a blurred app-switcher snapshot (`components/AppLock.vue`).
- **Accessibility**: text size (scales the whole app) and high contrast, also following the system's contrast setting.
