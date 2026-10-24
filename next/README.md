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

## Core tests

`test/core` pins the stored-data formats with values generated independently of the
app (ethers for HD keys, Node crypto for the cipher format, see `test/fixtures.ts`).
Run both `npm test` and `npm run test:legacy` after touching `src/core`: if either
fails, wallets saved by an earlier version may no longer open.
