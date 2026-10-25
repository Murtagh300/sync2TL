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
